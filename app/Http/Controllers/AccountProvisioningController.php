<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserAccount;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use App\Services\UserManagement\AccountProvisioningRoles;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Administrator-approved, create-only account provisioning.
 * No schema changes or unapproved activation/deactivation workflows.
 * Both account tables and the audit event commit atomically.
 */
final class AccountProvisioningController extends Controller
{
    public function store(Request $request, VerifiedProjectAccount $accounts, AccountProvisioningRoles $provisioningRoles): RedirectResponse
    {
        Gate::authorize('create', UserAccount::class);

        $actor = $request->user();
        abort_unless($actor instanceof User, 403);
        $role = $accounts->role($actor);
        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);
        $creator = $accounts->require($actor);

        // Role escalation is checked here, not trusted to the frontend. Engineering
        // identity creation is enabled only after approved DB role-constraint support.
        // SuperAdmin creation remains unavailable through this endpoint.
        $allowedRoles = $provisioningRoles->for($actor);
        abort_if($allowedRoles === [], 403);
        $validated = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['nullable', 'required_if:accountType,viewer', 'string', 'max:255'],
            'accountType' => ['required', Rule::in($allowedRoles)],
            'engineers_id' => ['nullable', 'integer', Rule::exists('engineers', 'id')],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        $username = strtolower(trim((string) $validated['username']));
        $email = strtolower(trim((string) $validated['email']));
        $accountRole = (string) $validated['accountType'];
        $engineerId = ! empty($validated['engineers_id']) ? (int) $validated['engineers_id'] : null;
        $displayName = trim((string) ($validated['name'] ?? ''));
        $password = (string) $validated['password'];

        if (in_array($accountRole, ['admin', 'engineer'], true) && $engineerId === null) {
            throw ValidationException::withMessages([
                'engineers_id' => 'Admin and Engineer accounts must link to an existing, unassigned Engineer.',
            ]);
        }
        if ($accountRole === 'viewer' && $engineerId !== null) {
            throw ValidationException::withMessages([
                'engineers_id' => 'Viewer accounts cannot have an Engineer link.',
            ]);
        }

        // Refuse provisioning if any required part of the deployed schema is missing.
        $required = [
            'users' => ['id', 'name', 'email', 'password', 'user_account_id', 'email_verified_at', 'created_at', 'updated_at'],
            'user_accounts' => ['id', 'username', 'password', 'accountType', 'engineers_id', 'is_active', 'created_by', 'created_at', 'updated_at'],
            'engineers' => ['id', 'first_name', 'middle_name', 'last_name', 'engineer_status'],
            'audit_logs' => ['id', 'user_id', 'actor_identifier', 'action', 'entity_type', 'entity_id', 'description', 'old_value', 'new_value', 'recipient_user_id', 'notification_message', 'created_at', 'updated_at'],
        ];
        foreach ($required as $table => $columns) {
            if (! Schema::hasTable($table)
                || array_diff($columns, Schema::getColumnListing($table)) !== []) {
                abort(503, 'Account provisioning requires an approved matching database schema.');
            }
        }

        try {
            DB::transaction(function () use (
                $username, $email, $accountRole, $engineerId, $displayName, $password, $creator
            ): void {
                // Serialize this app's concurrent provisioning requests in PostgreSQL.
                // Unique DB constraints are still required to protect other writers.
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');

                if (DB::table('user_accounts')->whereRaw('LOWER(username) = ?', [$username])->exists()) {
                    throw ValidationException::withMessages(['username' => 'This username is already registered.']);
                }
                if (DB::table('users')->whereRaw('LOWER(email) = ?', [$email])->exists()) {
                    throw ValidationException::withMessages(['email' => 'This login email is already registered.']);
                }

                $name = $displayName;
                if ($engineerId !== null) {
                    $engineer = DB::table('engineers')
                        ->where('id', $engineerId)->lockForUpdate()
                        ->first(['first_name', 'middle_name', 'last_name', 'engineer_status']);
                    if ($engineer === null) {
                        throw ValidationException::withMessages(['engineers_id' => 'Select an existing Engineer.']);
                    }
                    if ((string) $engineer->engineer_status !== 'Active') {
                        throw ValidationException::withMessages([
                            'engineers_id' => 'Only Active Engineers may receive new Admin or Engineer login accounts.',
                        ]);
                    }
                    if (DB::table('user_accounts')->where('engineers_id', $engineerId)->exists()) {
                        throw ValidationException::withMessages([
                            'engineers_id' => 'This Engineer already has a User Account.',
                        ]);
                    }
                    $name = trim(implode(' ', array_filter([
                        $engineer->first_name, $engineer->middle_name, $engineer->last_name,
                    ], static fn ($part): bool => is_string($part) && trim($part) !== '')));
                    if ($name === '') {
                        throw ValidationException::withMessages([
                            'engineers_id' => 'The selected Engineer has no valid display name.',
                        ]);
                    }
                }

                $now = now();
                $accountId = (int) DB::table('user_accounts')->insertGetId([
                    'username' => $username,
                    'password' => Hash::make($password),
                    'accountType' => $accountRole,
                    'engineers_id' => $engineerId,
                    'is_active' => true,
                    'created_by' => $creator->getKey(),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                // Laravel authentication uses users.email/password; this FK joins it
                // to the JaiROADS role. Never pretend user_accounts itself is a login.
                DB::table('users')->insert([
                    'name' => $name,
                    'email' => $email,
                    'password' => Hash::make($password),
                    'user_account_id' => $accountId,
                    'email_verified_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                // Append-only audit event in the SAME transaction; never log hashes.
                DB::table('audit_logs')->insert([
                    'user_id' => $creator->getKey(),
                    'actor_identifier' => (string) $creator->username,
                    'action' => 'CREATE',
                    'entity_type' => 'UserAccount',
                    'entity_id' => $accountId,
                    'description' => 'An authorized administrator provisioned a User Account.',
                    'old_value' => null,
                    'new_value' => json_encode([
                        'username' => $username,
                        'accountType' => $accountRole,
                        'engineers_id' => $engineerId,
                        'is_active' => true,
                    ], JSON_THROW_ON_ERROR),
                    'recipient_user_id' => null,
                    'notification_message' => '',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }, 3);
        } catch (QueryException $exception) {
            // Do not reveal database SQL, credentials, or hashes in the response.
            throw ValidationException::withMessages([
                'username' => 'The account could not be provisioned. No account was saved. Check the deployed role/foreign-key constraints with your team.',
            ]);
        }

        return redirect()->route('user-management.index')
            ->with('account_created', 'Account saved to Supabase and linked to a Laravel login.');
    }
}
