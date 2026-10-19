<?php

declare(strict_types=1);

namespace App\Http\Controllers\UserManagement;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Existing User Management screen only. No new roles, entity, schema migration,
 * hard deletes, or inferred privileges based on legacy engineers.lgus_id.
 */
final class EngineerAdministrationController extends Controller
{
    private function authorizeAdministrator(Request $request, VerifiedProjectAccount $accounts): object
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);
        abort_unless(in_array($accounts->role($user), ['admin', 'superadmin'], true), 403);

        // The role resolution rejects inactive accounts. The returned account is
        // the audit actor, NOT a Laravel User ID or an Engineer ID.
        return $accounts->require($user);
    }

    private function requireSchema(bool $assignments = false): void
    {
        $required = [
            'engineers' => [
                'id', 'first_name', 'middle_name', 'last_name', 'email',
                'contact_no', 'rank', 'position', 'lgus_id', 'engineer_status', 'created_at', 'updated_at',
            ],
            'lgus' => ['id'],
            'user_accounts' => ['id', 'engineers_id', 'is_active'],
            'audit_logs' => [
                'user_id', 'actor_identifier', 'action', 'entity_type', 'entity_id',
                'description', 'old_value', 'new_value', 'recipient_user_id',
                'notification_message', 'created_at', 'updated_at',
            ],
        ];

        if ($assignments) {
            $required['engineer_lgus'] = [
                'engineers_id', 'lgus_id', 'is_active', 'created_at', 'updated_at',
            ];
        }

        foreach ($required as $table => $columns) {
            if (! Schema::hasTable($table) || ! Schema::hasColumns($table, $columns)) {
                abort(503, 'Engineer management requires the approved deployed schema. No changes were made.');
            }
        }

        // This feature's transaction and advisory-lock semantics target Supabase PostgreSQL.
        abort_unless(DB::connection()->getDriverName() === 'pgsql', 503, 'Engineer management requires PostgreSQL.');
    }

    private function audit(object $actor, string $action, string $entity, int $entityId, string $description, ?array $before, array $after): void
    {
        $now = now();
        DB::table('audit_logs')->insert([
            'user_id' => (int) $actor->getKey(),
            'actor_identifier' => (string) $actor->username,
            'action' => $action,
            'entity_type' => $entity,
            // EngineerLGU has a composite key, so its legacy Engineer ID remains the audit
            // entity_id until nullable-entity_id migration; full pair is preserved in old_value/new_value.
            'entity_id' => $entityId,
            'description' => $description,
            'old_value' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR),
            'new_value' => json_encode($after, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null,
            'notification_message' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /** @return array<string, mixed> */
    private function validateEngineer(Request $request, bool $creating): array
    {
        $rules = [
            'first_name' => ['required', 'string', 'max:100'],
            // The current physical schema requires middle_name; do not silently
            // change its nullability. Enter 'N/A' when genuinely not applicable.
            'middle_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'contact_no' => ['required', 'string', 'max:30', function (string $attribute, mixed $value, \Closure $fail): void {
                // Final Data Dictionary: local/international formats; current NOT NULL retained.
                $digits = preg_replace('/[\s().-]+/', '', (string) $value);
                if (! is_string($digits) || ! preg_match('/\A\+?[0-9]{7,15}\z/', $digits)) {
                    $fail('Enter a valid 7–15 digit local/international contact number (30 characters maximum).');
                }
            }],
            'rank' => ['required', 'string', 'max:100'],
            'position' => ['required', 'string', 'max:255'],
        ];
        if (! $creating) {
            $rules['engineer_status'] = ['required', Rule::in(['Active', 'Retired'])];
        }
        if ($creating) {
            $rules['lgus_id'] = ['required', 'integer', Rule::exists('lgus', 'id')];
        }
        $validated = $request->validate($rules);
        foreach (['first_name', 'middle_name', 'last_name', 'rank', 'position'] as $key) {
            $validated[$key] = trim((string) $validated[$key]);
            if ($validated[$key] === '') {
                throw ValidationException::withMessages([$key => 'This field must not be blank.']);
            }
        }
        $validated['email'] = strtolower(trim((string) $validated['email']));
        $validated['contact_no'] = trim((string) $validated['contact_no']);

        return $validated;
    }

    public function storeEngineer(Request $request, VerifiedProjectAccount $accounts): RedirectResponse
    {
        $actor = $this->authorizeAdministrator($request, $accounts);
        $this->requireSchema(true);
        $validated = $this->validateEngineer($request, true);
        $lguId = (int) $validated['lgus_id'];

        try {
            DB::transaction(function () use ($actor, $validated, $lguId): void {
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                if (! DB::table('lgus')->where('id', $lguId)->exists()) {
                    throw ValidationException::withMessages(['lgus_id' => 'Choose an existing LGU.']);
                }
                if (DB::table('engineers')->whereRaw('LOWER(email) = ?', [$validated['email']])->exists()) {
                    throw ValidationException::withMessages(['email' => 'This Engineer email already exists.']);
                }
                $now = now();
                $engineerId = (int) DB::table('engineers')->insertGetId(array_merge($validated, [
                    'lgus_id' => $lguId, 'engineer_status' => 'Active', 'created_at' => $now, 'updated_at' => $now,
                ]));
                DB::table('engineer_lgus')->insert([
                    'engineers_id' => $engineerId,
                    'lgus_id' => $lguId,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->audit($actor, 'CREATE', 'Engineer', $engineerId,
                    'An authorized administrator created an Engineer identity and initial active LGU assignment.',
                    null, ['engineers_id' => $engineerId, 'engineer_status' => 'Active',
                        'initial_lgu_id' => $lguId]);
            }, 3);
        } catch (QueryException $exception) {
            throw ValidationException::withMessages(['first_name' => 'Engineer creation failed without saving. Check deployed constraints and try again.']);
        }

        return to_route('user-management.index')->with('user_management_status', 'Engineer and initial LGU assignment created successfully.');
    }

    public function updateEngineer(Request $request, int $engineer, VerifiedProjectAccount $accounts): RedirectResponse
    {
        $actor = $this->authorizeAdministrator($request, $accounts);
        $this->requireSchema(true);
        $validated = $this->validateEngineer($request, false);
        // Do not allow changing legacy primary lgus_id through profile editing.
        // Assignments are managed exclusively through engineer_lgus actions.

        try {
            DB::transaction(function () use ($actor, $engineer, $validated): void {
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                $original = DB::table('engineers')->where('id', $engineer)->lockForUpdate()->first();
                abort_if($original === null, 404);
                if (DB::table('engineers')->where('id', '<>', $engineer)
                    ->whereRaw('LOWER(email) = ?', [$validated['email']])->exists()) {
                    throw ValidationException::withMessages(['email' => 'This Engineer email already exists.']);
                }
                $oldStatus = (string) $original->engineer_status;
                $newStatus = (string) $validated['engineer_status'];
                if ($oldStatus === 'Retired' && $newStatus !== 'Retired') {
                    throw ValidationException::withMessages([
                        'engineer_status' => 'Reactivation of a retired Engineer requires a separately approved workflow.',
                    ]);
                }
                if ($oldStatus === 'Active' && $newStatus === 'Retired') {
                    // Fail closed until all access/assignments have been explicitly deactivated.
                    // Do not silently mutate the linked account or historical assignments.
                    if (DB::table('engineer_lgus')->where('engineers_id', $engineer)
                        ->where('is_active', true)->exists()) {
                        throw ValidationException::withMessages([
                            'engineer_status' => 'Deactivate all active LGU assignments before retiring this Engineer.',
                        ]);
                    }
                    if (DB::table('user_accounts')->where('engineers_id', $engineer)
                        ->where('is_active', true)->exists()) {
                        throw ValidationException::withMessages([
                            'engineer_status' => 'The linked login account is active. Deactivate it through an approved account workflow before retiring this Engineer.',
                        ]);
                    }
                }
                $before = [];
                $after = [];
                foreach ($validated as $key => $value) {
                    if ((string) ($original->{$key} ?? '') !== (string) $value) {
                        $before[$key] = $original->{$key};
                        $after[$key] = $value;
                    }
                }
                if ($after === []) {
                    return; // Final Data Dictionary: unchanged save does not emit an audit event.
                }
                DB::table('engineers')->where('id', $engineer)->update(array_merge($validated, ['updated_at' => now()]));
                $this->audit($actor, 'UPDATE', 'Engineer', $engineer,
                    'An authorized administrator updated Engineer profile/status (not the login or LGU assignments).',
                    $before, $after);
            }, 3);
        } catch (QueryException $exception) {
            throw ValidationException::withMessages(['email' => 'Engineer update failed without saving. Check deployed constraints.']);
        }

        return to_route('user-management.index')->with('user_management_status', 'Engineer profile updated successfully.');
    }

    public function storeAssignment(Request $request, VerifiedProjectAccount $accounts): RedirectResponse
    {
        $actor = $this->authorizeAdministrator($request, $accounts);
        $this->requireSchema(true);
        $data = $request->validate([
            'engineers_id' => ['required', 'integer', Rule::exists('engineers', 'id')],
            'lgus_id' => ['required', 'integer', Rule::exists('lgus', 'id')],
        ]);
        $engineerId = (int) $data['engineers_id'];
        $lguId = (int) $data['lgus_id'];

        try {
            DB::transaction(function () use ($actor, $engineerId, $lguId): void {
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                $row = DB::table('engineer_lgus')
                    ->where('engineers_id', $engineerId)->where('lgus_id', $lguId)
                    ->lockForUpdate()->first();
                if ($row !== null && (bool) $row->is_active) {
                    throw ValidationException::withMessages(['lgus_id' => 'This Engineer already has an active assignment to that LGU.']);
                }
                $status = DB::table('engineers')->where('id', $engineerId)
                    ->lockForUpdate()->value('engineer_status');
                if ($status !== 'Active') {
                    throw ValidationException::withMessages([
                        'engineers_id' => 'Only Active Engineers may receive active LGU assignments.',
                    ]);
                }
                $now = now();
                if ($row === null) {
                    DB::table('engineer_lgus')->insert([
                        'engineers_id' => $engineerId, 'lgus_id' => $lguId,
                        'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                } else {
                    DB::table('engineer_lgus')->where('engineers_id', $engineerId)
                        ->where('lgus_id', $lguId)->update(['is_active' => true, 'updated_at' => $now]);
                }
                $this->audit($actor, $row === null ? 'CREATE' : 'ACTIVATE', 'EngineerLGU', $engineerId,
                    'An authorized administrator '.($row === null ? 'created' : 'reactivated').' an Engineer–LGU assignment.',
                    $row === null ? null : ['engineers_id' => $engineerId, 'lgus_id' => $lguId, 'is_active' => false],
                    ['engineers_id' => $engineerId, 'lgus_id' => $lguId, 'is_active' => true]);
            }, 3);
        } catch (QueryException $exception) {
            throw ValidationException::withMessages(['lgus_id' => 'Assignment could not be saved. Confirm the Engineer–LGU uniqueness constraint.']);
        }

        return to_route('user-management.index')->with('user_management_status', 'Active LGU assignment saved.');
    }

    public function setAssignmentStatus(Request $request, int $engineer, int $lgu, VerifiedProjectAccount $accounts): RedirectResponse
    {
        $actor = $this->authorizeAdministrator($request, $accounts);
        $this->requireSchema(true);
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $active = (bool) $validated['is_active'];

        DB::transaction(function () use ($actor, $engineer, $lgu, $active): void {
            DB::select('SELECT pg_advisory_xact_lock(1927710914)');
            $row = DB::table('engineer_lgus')->where('engineers_id', $engineer)
                ->where('lgus_id', $lgu)->lockForUpdate()->first();
            abort_if($row === null, 404, 'No Engineer–LGU assignment exists for this pair.');
            if ((bool) $row->is_active === $active) {
                return; // Idempotent; do not write an audit event for a no-op.
            }
            if ($active) {
                $status = DB::table('engineers')->where('id', $engineer)
                    ->lockForUpdate()->value('engineer_status');
                if ($status !== 'Active') {
                    throw ValidationException::withMessages([
                        'is_active' => 'Cannot activate an LGU assignment for a Retired Engineer.',
                    ]);
                }
            }
            DB::table('engineer_lgus')->where('engineers_id', $engineer)
                ->where('lgus_id', $lgu)->update(['is_active' => $active, 'updated_at' => now()]);
            $before = ['engineers_id' => $engineer, 'lgus_id' => $lgu, 'is_active' => (bool) $row->is_active];
            $after = ['engineers_id' => $engineer, 'lgus_id' => $lgu, 'is_active' => $active];
            $this->audit($actor, $active ? 'ACTIVATE' : 'DEACTIVATE', 'EngineerLGU', $engineer,
                'An authorized administrator '.($active ? 'reactivated' : 'deactivated').' an Engineer–LGU assignment.',
                $before, $after);
        }, 3);

        return to_route('user-management.index')->with('user_management_status', $active ? 'Assignment activated.' : 'Assignment deactivated. Engineer access to this LGU is now restricted.');
    }
}
