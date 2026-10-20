<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdActivityNotifications;
use App\Services\DataDictionary\DdDashboardAnalytics;
use App\Services\DataDictionary\DdRoleAccess;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * PHASE 3A: DD-only role access + essential identity/LGU administration.
 * Never uses legacy public business tables; public.users is Fortify infrastructure.
 * All writes use existing, approved DD entities + a system-written AuditLog.
 *
 * @phpstan-import-type Identity from DataDictionaryIdentityResolver
 */
final class DdPhase3Controller extends Controller
{
    /**
     * @return Identity
     */
    private function identity(Request $request, DataDictionaryIdentityResolver $resolver): array
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('dd_user_account_id') !== null, 403);
        $identity = $resolver->resolve($user);
        abort_unless($identity !== null, 403, 'Your account is unavailable. Please contact your administrator.');

        return $identity;
    }

    /**
     * @return Identity
     */
    private function admin(Request $request, DataDictionaryIdentityResolver $resolver): array
    {
        $id = $this->identity($request, $resolver);
        abort_unless(DdRoleAccess::canManageAccounts($id['role']), 403);

        return $id;
    }

    /**
     * @param  Identity  $actor
     * @param  array<string, mixed>  $details
     */
    private function audit(array $actor, string $action, string $entity, int $recordId, string $description, array $details): void
    {
        // Never include password, email, token or secret in the audit payload.
        DB::table('jairoads_next.audit_logs')->insert([
            'user_id' => $actor['account_id'],
            'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'],
            'action' => $action,
            'entity_type' => $entity,
            'entity_id' => $recordId,
            'description' => $description,
            'old_value' => null,
            'new_value' => json_encode($details, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null,
            'notification_message' => null,
            'created_at' => now(),
        ]);
        app(DdActivityNotifications::class)
            ->record($actor, $action, $entity, $recordId, $description);
    }

    public function show(string $section, Request $request, DataDictionaryIdentityResolver $resolver): Response|RedirectResponse
    {
        // The single named DD GET route dispatches to one of the two DD-only
        // controllers. Keep these sections separate from legacy public CRUD.
        if (in_array($section, ['settings', 'roads', 'projects', 'updates', 'documents'], true)) {
            return app(DdOperationsController::class)->show($section, $request, $resolver);
        }

        $actor = $this->identity($request, $resolver);
        abort_unless(in_array($section, ['dashboard', 'users', 'lgus'], true), 404);
        if ($section === 'dashboard' && $actor['role'] === 'SuperAdmin') {
            return redirect()->route('jairoads.dd-superadmin-landing');
        }
        if ($section === 'users') {
            abort_unless(DdRoleAccess::canManageAccounts($actor['role']), 403);
        }
        $t = static fn (string $name) => DB::table('jairoads_next.'.$name);
        $lguQuery = $t('lgus')->orderBy('id');
        if ($actor['role'] === 'Engineer') {
            // Engineer visibility is limited to their CURRENT active LGU scope.
            $lguQuery->whereIn('id', $t('engineer_lgus')
                ->where('engineer_id', $actor['engineer_id'])
                ->where('is_active', true)->select('lgu_id'));
        }
        $lgus = $lguQuery->limit(200)->get([
            'id', 'municipality_name', 'province', 'region',
            'mayor_first_name', 'mayor_middle_name', 'mayor_last_name',
        ]);
        $allowedManager = DdRoleAccess::canManageAccounts($actor['role']);
        $accounts = $allowedManager ? $t('user_accounts')->orderBy('id')->limit(200)->get([
            'id', 'username', 'email', 'account_type', 'engineer_id', 'is_active',
        ]) : collect();
        $engineers = $allowedManager ? $t('engineers')->orderBy('id')->limit(200)->get([
            'id', 'first_name', 'middle_name', 'last_name', 'contact_no', 'rank', 'engineer_status',
        ]) : collect();
        $assignments = $allowedManager ? $t('engineer_lgus')->orderBy('engineer_id')->limit(300)->get([
            'engineer_id', 'lgu_id', 'is_active',
        ]) : collect();
        $counts = [
            'lgus' => $lguQuery->count(),
            'roadCoverages' => $actor['role'] === 'Engineer'
                ? (int) $t('road_coverages')->whereIn('lgu_id', $t('engineer_lgus')->where('engineer_id', $actor['engineer_id'])->where('is_active', true)->select('lgu_id'))->count()
                : (int) $t('road_coverages')->count(),
            'maintenanceProjects' => $allowedManager || $actor['role'] === 'Viewer'
                ? (int) $t('maintenance_projects')->count() : null,
            'userAccounts' => $allowedManager ? (int) $t('user_accounts')->count() : null,
            'maintenanceRecords' => $allowedManager ? (int) $t('maintenance_records')->count() : null,
            'monthlyUpdates' => $allowedManager ? (int) $t('monthly_updates')->count() : null,
            'documents' => $allowedManager ? (int) $t('maintenance_documents')->count() : null,
        ];
        $userName = $t('user_accounts')->where('id', $actor['account_id'])->value('username');

        return Inertia::render('dd-phase3/Workspace', [
            'section' => $section,
            'identity' => ['role' => $actor['role'], 'username' => (string) $userName],
            'counts' => $counts,
            'analytics' => $section === 'dashboard' ? app(DdDashboardAnalytics::class)->summary($actor) : null,
            'lgus' => $lgus, 'accounts' => $accounts,
            'engineers' => $engineers, 'assignments' => $assignments,
            'canManage' => $allowedManager,
            // Both authorized administrative roles can create standard DD accounts.
            // Initial SuperAdmin creation is a separate owner-verified bootstrap.
            'canCreateRoles' => $allowedManager ? ['Admin', 'Engineer', 'Viewer'] : [],
            'status' => $request->session()->get('dd_phase3_status'),
        ]);
    }

    public function createLgu(Request $request, DataDictionaryIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $v = $request->validate([
            'municipality_name' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'mayor_first_name' => ['required', 'string', 'max:100'],
            'mayor_middle_name' => ['nullable', 'string', 'max:100'],
            'mayor_last_name' => ['required', 'string', 'max:100'],
        ]);
        DB::transaction(function () use ($actor, $v): void {
            $id = (int) DB::table('jairoads_next.lgus')->insertGetId($v);
            $this->audit($actor, 'CREATE', 'LGU', $id, 'Authorized administrator created an LGU.', ['lgu_id' => $id]);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'lgus'])->with('dd_phase3_status', 'Municipality created.');
    }

    /**
     * Admin/SuperAdmin LGU maintenance only. Dependent RoadCoverage and
     * EngineerLGU rows are protected by the approved restrictive foreign keys.
     */
    public function updateLgu(Request $request, DataDictionaryIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $v = $request->validate([
            'municipality_name' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'mayor_first_name' => ['required', 'string', 'max:100'],
            'mayor_middle_name' => ['nullable', 'string', 'max:100'],
            'mayor_last_name' => ['required', 'string', 'max:100'],
        ]);
        DB::transaction(function () use ($actor, $id, $v): void {
            $row = DB::table('jairoads_next.lgus')->where('id', $id)->lockForUpdate()->first(['id']);
            abort_unless($row !== null, 404);
            DB::table('jairoads_next.lgus')->where('id', $id)->update($v);
            $this->audit($actor, 'UPDATE', 'LGU', $id, 'Authorized administrator updated an LGU.', ['lgu_id' => $id]);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'lgus'])->with('dd_phase3_status', 'Municipality updated.');
    }

    public function deleteLgu(Request $request, DataDictionaryIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        DB::transaction(function () use ($actor, $id): void {
            $row = DB::table('jairoads_next.lgus')->where('id', $id)->lockForUpdate()->first(['id']);
            abort_unless($row !== null, 404);
            try {
                DB::table('jairoads_next.lgus')->where('id', $id)->delete();
            } catch (QueryException $e) {
                if ((string) $e->getCode() !== '23503' && ($e->errorInfo[0] ?? '') !== '23503') {
                    throw $e;
                }
                throw ValidationException::withMessages([
                    'delete' => 'The LGU is referenced by road coverage or engineer assignments. Retain the LGU until those dependencies are explicitly handled.',
                ]);
            }
            $this->audit($actor, 'DELETE', 'LGU', $id, 'Authorized administrator deleted an unreferenced LGU.', ['lgu_id' => $id]);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'lgus'])->with('dd_phase3_status', 'Municipality deleted.');
    }

    public function createEngineer(Request $request, DataDictionaryIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        // ContactNo is REQUIRED on new forms pending the DD nullability conflict;
        // this satisfies both competing tab definitions without changing DDL.
        $v = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_no' => ['required', 'string', 'max:30'],
            'rank' => ['required', 'string', 'max:100'],
        ]);
        $v['engineer_status'] = 'Active';
        DB::transaction(function () use ($actor, $v): void {
            $id = (int) DB::table('jairoads_next.engineers')->insertGetId($v);
            $this->audit($actor, 'CREATE', 'Engineer', $id, 'Authorized administrator created an Engineer.', ['engineer_id' => $id, 'engineer_status' => 'Active']);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'users'])->with('dd_phase3_status', 'Engineer profile created.');
    }

    public function setAssignment(Request $request, DataDictionaryIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $v = $request->validate(['engineer_id' => ['required', 'integer', 'min:1'], 'lgu_id' => ['required', 'integer', 'min:1'], 'is_active' => ['required', 'boolean']]);
        DB::transaction(function () use ($actor, $v): void {
            DB::select('SELECT pg_advisory_xact_lock(1927710915)');
            $engineer = DB::table('jairoads_next.engineers')->where('id', $v['engineer_id'])->lockForUpdate()->first(['id', 'engineer_status']);
            if (! $engineer || (string) $engineer->engineer_status !== 'Active') {
                throw ValidationException::withMessages(['engineer_id' => 'Only active Engineers may be assigned.']);
            }
            if (! DB::table('jairoads_next.lgus')->where('id', $v['lgu_id'])->exists()) {
                throw ValidationException::withMessages(['lgu_id' => 'LGU does not exist.']);
            }
            $key = ['engineer_id' => (int) $v['engineer_id'], 'lgu_id' => (int) $v['lgu_id']];
            $existing = DB::table('jairoads_next.engineer_lgus')->where($key)->first(['is_active']);
            if ($existing) {
                DB::table('jairoads_next.engineer_lgus')->where($key)->update(['is_active' => (bool) $v['is_active']]);
            } else {
                DB::table('jairoads_next.engineer_lgus')->insert($key + ['is_active' => (bool) $v['is_active']]);
            }
            $this->audit($actor, $existing ? 'UPDATE' : 'CREATE', 'EngineerLGU', (int) $v['engineer_id'], 'Authorized administrator maintained an EngineerLGU assignment.', $key + ['is_active' => (bool) $v['is_active']]);
        });

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'users'])->with('dd_phase3_status', 'Engineer assignment saved.');
    }

    public function createAccount(Request $request, DataDictionaryIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $allowed = ['Admin', 'Engineer', 'Viewer'];
        $v = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'account_type' => ['required', Rule::in($allowed)],
            'engineer_id' => ['nullable', 'integer', 'min:1'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $username = strtolower(trim((string) $v['username']));
        $email = strtolower(trim((string) $v['email']));
        $role = $v['account_type'];
        $engineerId = ! empty($v['engineer_id']) ? (int) $v['engineer_id'] : null;
        // Explicitly allow unlinked Admin/Engineer provisioning. Viewer is
        // deliberately kept unlinked. A missing link never grants LGU scope.
        if ($role === 'Viewer' && $engineerId !== null) {
            throw ValidationException::withMessages(['engineer_id' => 'Viewer accounts cannot be linked to an Engineer.']);
        }
        try {
            DB::transaction(function () use ($actor, $v, $username, $email, $role, $engineerId): void {
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                if (DB::table('public.users')->whereRaw('LOWER(email) = ?', [$email])->exists()
                    || DB::table('jairoads_next.user_accounts')->whereRaw('LOWER(email) = ?', [$email])->exists()) {
                    throw ValidationException::withMessages(['email' => 'Email already exists.']);
                }
                if (DB::table('jairoads_next.user_accounts')->whereRaw('LOWER(username) = ?', [$username])->exists()) {
                    throw ValidationException::withMessages(['username' => 'Username already exists.']);
                }
                if ($engineerId !== null) {
                    $engineer = DB::table('jairoads_next.engineers')->where('id', $engineerId)->lockForUpdate()->first(['engineer_status']);
                    if (! $engineer || (string) $engineer->engineer_status !== 'Active'
                        || DB::table('jairoads_next.user_accounts')->where('engineer_id', $engineerId)->exists()) {
                        throw ValidationException::withMessages(['engineer_id' => 'Engineer is retired, missing or already linked to an account.']);
                    }
                }
                $hashed = Hash::make((string) $v['password']);
                $ddId = (int) DB::table('jairoads_next.user_accounts')->insertGetId([
                    'username' => $username, 'email' => $email, 'password' => $hashed,
                    'account_type' => $role, 'engineer_id' => $engineerId,
                    'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                ]);
                // Keep public.users strictly as Fortify infrastructure; no legacy role FK.
                DB::table('public.users')->insert([
                    'name' => trim((string) $v['name']), 'email' => $email,
                    'password' => $hashed, 'user_account_id' => null,
                    'dd_user_account_id' => $ddId,
                    'email_verified_at' => null, 'created_at' => now(), 'updated_at' => now(),
                ]);
                $this->audit($actor, 'CREATE', 'UserAccount', $ddId, 'Administrator provisioned a DD account with an explicit Fortify link.', [
                    'account_type' => $role, 'engineer_id' => $engineerId, 'is_active' => true,
                ]);
            }, 2);
        } catch (QueryException) {
            throw ValidationException::withMessages(['account_type' => 'The database rejected account provisioning. No account was created. Confirm the active UserAccount constraints and submitted values.']);
        }

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'users'])->with('dd_phase3_status', 'Account created.');
    }
}
