<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\AccountProvisioning;
use App\Services\LinkedPasswordUpdater;
use App\Services\OperationAudit;
use App\Services\RoleAccess;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use stdClass;

/** Canonical lifecycle operations; retained rows and the current transactional audit writer. */
final class PeopleLifecycleController extends Controller
{
    /** @return array{account_id:int,role:string,engineer_id:?int} */
    private function admin(Request $request, AccountIdentityResolver $resolver): array
    {
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $actor = $resolver->resolve($login);
        abort_unless($actor !== null && RoleAccess::canManageAccounts($actor['role']), 403);

        return $actor;
    }

    /** @param array{account_id:int,role:string,engineer_id:?int} $actor */
    private function currentActor(array $actor, Request $request, AccountIdentityResolver $resolver): void
    {
        DB::select('SELECT pg_advisory_xact_lock(1927710916)');
        abort_unless($this->admin($request, $resolver) === $actor, 403);
    }

    private function engineer(int $id): stdClass
    {
        $row = DB::table('jairoads_next.engineers')->where('id', $id)->lockForUpdate()->first();
        abort_unless($row instanceof stdClass, 404);

        return $row;
    }

    private function active(mixed $value): bool
    {
        return in_array($value, [true, 1, '1', 't', 'true'], true);
    }

    /** @param array{account_id:int,role:string,engineer_id:?int} $actor
     * @param  array<string,mixed>  $old
     * @param  array<string,mixed>  $new
     */
    private function audit(array $actor, string $entity, int $id, string $description, array $old, array $new, string $action = 'UPDATE'): void
    {
        app(OperationAudit::class)->record($actor, $action, $entity, $id, $description, $new, $old);
    }

    public function updateEngineer(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'], 'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'], 'contact_no' => ['required', 'string', 'max:30'],
            'rank' => ['required', 'string', 'max:100'], 'engineer_status' => ['prohibited'], 'position' => ['prohibited'],
        ]);
        DB::transaction(function () use ($request, $resolver, $actor, $data, $id): void {
            $this->currentActor($actor, $request, $resolver);
            $row = $this->engineer($id);
            $old = $new = [];
            foreach (['first_name', 'middle_name', 'last_name', 'contact_no', 'rank'] as $field) {
                $value = isset($data[$field]) ? trim($data[$field]) : null;
                $value = $field === 'middle_name' && $value === '' ? null : $value;
                if ($value !== $row->$field) {
                    $old[$field] = $row->$field;
                    $new[$field] = $value;
                }
            }
            if ($new !== []) {
                DB::table('jairoads_next.engineers')->where('id', $id)->update($new);
                $this->audit($actor, 'Engineer', $id, 'Administrator updated Engineer profile details.', $old, $new);
            }
        }, 3);

        return back()->with('dd_phase3_status', 'Engineer profile saved.');
    }

    public function retireEngineer(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        DB::transaction(function () use ($request, $resolver, $actor, $id): void {
            // Serialize against provisioning so an unlinked profile cannot gain a new account mid-retirement.
            DB::select('SELECT pg_advisory_xact_lock(1927710914)');
            $this->currentActor($actor, $request, $resolver);
            if ($actor['engineer_id'] === $id) {
                throw ValidationException::withMessages(['retirement' => 'Another administrator must retire your linked profile to avoid locking you out.']);
            }
            $accountId = DB::table('jairoads_next.user_accounts')->where('engineer_id', $id)->value('id');
            if ($accountId !== null) {
                // Match LinkedPasswordUpdater's login -> canonical account -> Engineer lock order.
                DB::table('public.users')->where('dd_user_account_id', $accountId)->orderBy('id')->lockForUpdate()->get(['id']);
            }
            $account = $accountId === null ? null : DB::table('jairoads_next.user_accounts')->where('id', $accountId)->lockForUpdate()->first();
            $profile = $this->engineer($id);
            if ($account !== null && $this->active($account->is_active)) {
                $this->protectLastSuperAdmin($account);
                DB::table('jairoads_next.user_accounts')->where('id', $accountId)->update(['is_active' => false, 'updated_at' => now()]);
                $this->audit($actor, 'UserAccount', (int) $accountId, 'Linked account deactivated during Engineer retirement.', ['is_active' => true], ['is_active' => false], 'DEACTIVATE');
            }
            $assignments = DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $id)->where('is_active', true)->orderBy('lgu_id')->lockForUpdate()->get(['lgu_id']);
            foreach ($assignments as $assignment) {
                DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $id)->where('lgu_id', $assignment->lgu_id)->update(['is_active' => false]);
                $key = ['engineer_id' => $id, 'lgu_id' => (int) $assignment->lgu_id];
                $this->audit($actor, 'EngineerLGU', $id, 'LGU assignment deactivated during Engineer retirement.', $key + ['is_active' => true], $key + ['is_active' => false], 'DEACTIVATE');
            }
            if ($profile->engineer_status !== 'Retired') {
                DB::table('jairoads_next.engineers')->where('id', $id)->update(['engineer_status' => 'Retired']);
                $this->audit($actor, 'Engineer', $id, 'Administrator retired Engineer; historical references retained.', ['engineer_status' => $profile->engineer_status], ['engineer_status' => 'Retired'], 'RETIRE');
            }
        }, 3);

        return back()->with('dd_phase3_status', 'Engineer retired; linked account and active assignments deactivated.');
    }

    private function protectLastSuperAdmin(stdClass $account): void
    {
        if ($account->account_type !== 'SuperAdmin' || ! $this->active($account->is_active)) {
            return;
        }
        $candidates = User::whereIn('dd_user_account_id', DB::table('jairoads_next.user_accounts')
            ->where('account_type', 'SuperAdmin')->where('is_active', true)->where('id', '!=', $account->id)->select('id'))->get();
        $resolver = app(AccountIdentityResolver::class);
        if (! $candidates->contains(fn (User $login): bool => $resolver->resolve($login) !== null)) {
            throw ValidationException::withMessages(['is_active' => 'Keep at least one eligible active SuperAdmin account.']);
        }
    }

    public function accountDetails(Request $request, AccountIdentityResolver $resolver, int $id): JsonResponse
    {
        $actor = $this->admin($request, $resolver);
        $account = DB::table('jairoads_next.user_accounts')->where('id', $id)
            ->first(['id', 'username', 'email', 'account_type', 'engineer_id', 'is_active', 'created_at', 'updated_at']);
        abort_unless($account instanceof stdClass, 404);
        $engineer = $account->engineer_id === null ? null : DB::table('jairoads_next.engineers')->where('id', $account->engineer_id)
            ->first(['id', 'first_name', 'middle_name', 'last_name', 'contact_no', 'rank', 'engineer_status']);

        $reason = $this->passwordRecoveryBlocker($actor, $account, $engineer, $resolver);

        return response()->json([
            'account' => $account, 'engineer' => $engineer,
            'can_reset_password' => $reason === null,
            'password_reset_blocker' => $reason,
        ])->header('Cache-Control', 'private, no-store');
    }

    /**
     * Explain an unavailable reset without exposing credentials or weakening identity checks.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    private function passwordRecoveryBlocker(array $actor, stdClass $account, ?stdClass $engineer, AccountIdentityResolver $resolver): ?string
    {
        if ($actor['role'] !== 'SuperAdmin') {
            return 'Only a SuperAdmin can reset another account without email.';
        }
        if ($actor['account_id'] === (int) $account->id || $account->account_type === 'SuperAdmin') {
            return 'SuperAdmin passwords must be changed through the account security settings or the approved recovery procedure.';
        }
        if (! $this->active($account->is_active)) {
            return 'This account is inactive. Reactivate it before resetting its password.';
        }
        $engineerId = $account->engineer_id === null ? null : (int) $account->engineer_id;
        if (! AccountIdentityResolver::roleLinkValid((string) $account->account_type, $engineerId)
            || ($engineerId !== null && ($engineer === null || $engineer->engineer_status !== 'Active'))) {
            return 'The account needs a valid active Engineer profile before password recovery.';
        }
        $logins = User::query()->where('dd_user_account_id', $account->id)->limit(2)->get();
        if ($logins->count() !== 1) {
            return 'The account has a missing or duplicate sign-in link. A database administrator must review the existing login link before recovery.';
        }
        $target = $logins->first();
        if (strcasecmp((string) $target->email, (string) $account->email) !== 0) {
            return 'The registered email differs between the account and its sign-in record. A database administrator must review the link.';
        }
        if ($resolver->resolveForRecovery($target) !== null) {
            return null;
        }
        $provisioning = app(AccountProvisioning::class);
        if (! $provisioning->available()) {
            return 'The account authorization registry is unavailable. The database administrator must check its configuration and permissions.';
        }
        if (! $provisioning->verified((int) $account->id, (string) $account->account_type, $engineerId)) {
            return 'This existing account lacks matching administrator provisioning approval. A database administrator must complete the approved account review before password recovery.';
        }

        return 'This account did not pass the sign-in eligibility checks. A database administrator must review its authorization record.';
    }

    /** SuperAdmin-assisted recovery, independent of mailbox access. */
    public function resetAccountPassword(Request $request, AccountIdentityResolver $resolver, LinkedPasswordUpdater $passwords, int $id): JsonResponse
    {
        $actor = $this->admin($request, $resolver);
        abort_unless($actor['role'] === 'SuperAdmin' && $actor['account_id'] !== $id, 403);
        $v = $request->validate([
            'current_password' => ['required', 'string', 'max:1024'],
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols(),
                function ($attribute, $value, $fail) {
                    if (is_string($value) && strlen($value) > 72) {
                        $fail('The new password must not exceed 72 bytes.');
                    }
                }],
        ]);
        try {
            DB::transaction(function () use ($actor, $request, $resolver, $passwords, $id, $v): void {
                $this->currentActor($actor, $request, $resolver);
                $administrator = User::query()->whereKey($request->user()->getKey())->lockForUpdate()->first();
                abort_unless($administrator !== null && $resolver->resolve($administrator) === $actor, 403);
                if (! Hash::check($v['current_password'], $administrator->getAuthPassword())) {
                    throw ValidationException::withMessages(['current_password' => 'Your SuperAdmin password is incorrect.']);
                }
                $target = User::query()->where('dd_user_account_id', $id)->lockForUpdate()->first();
                $account = DB::table('jairoads_next.user_accounts')->where('id', $id)->lockForUpdate()->first();
                abort_unless($account !== null, 404);
                abort_unless(in_array($account->account_type, ['Admin', 'Engineer', 'Viewer'], true), 403);
                if ($target === null || $resolver->resolveForRecovery($target) === null) {
                    throw ValidationException::withMessages(['password' => 'This account is inactive, retired or has an invalid login link. Review its account status before recovery.']);
                }
                // Reuse the existing synchronized hash write and session revocation.
                $passwords->reset($target, $v['password']);
                // Invalidate any outstanding email recovery token as part of the same transaction.
                $broker = (string) config('auth.defaults.passwords', 'users');
                DB::table(config('auth.passwords.'.$broker.'.table', 'password_reset_tokens'))
                    ->where('email', $target->getEmailForPasswordReset())->delete();
                app(OperationAudit::class)->recordAdministratorPasswordReset($actor, $id);
            }, 3);
        } catch (QueryException) {
            // Never return SQL bindings, passwords or hashes in an error.
            throw ValidationException::withMessages(['password' => 'Password reset could not be completed. No successful reset was confirmed.']);
        }

        return response()->json(['message' => 'Password reset successfully. The account can sign in with the new password.'])
            ->header('Cache-Control', 'private, no-store');
    }

    public function accountStatus(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $data = $request->validate(['is_active' => ['required', 'boolean'],
            'account_type' => ['prohibited'], 'engineer_id' => ['prohibited'], 'password' => ['prohibited'],
            'username' => ['prohibited'], 'email' => ['prohibited'], 'dd_user_account_id' => ['prohibited']]);
        $active = $this->active($data['is_active']);
        DB::transaction(function () use ($request, $resolver, $actor, $id, $active): void {
            $this->currentActor($actor, $request, $resolver);
            $logins = DB::table('public.users')->where('dd_user_account_id', $id)->orderBy('id')->lockForUpdate()->get(['id', 'email', 'password']);
            $account = DB::table('jairoads_next.user_accounts')->where('id', $id)->lockForUpdate()->first();
            abort_unless($account instanceof stdClass, 404);
            if (! $active && $actor['account_id'] === $id) {
                throw ValidationException::withMessages(['is_active' => 'You cannot deactivate your own account. Ask another administrator.']);
            }
            if ($this->active($account->is_active) === $active) {
                return;
            }
            if (! $active) {
                $this->protectLastSuperAdmin($account);
            } else {
                $valid = AccountIdentityResolver::roleLinkValid($account->account_type, $account->engineer_id)
                    && ! ($account->account_type === 'Engineer' && $account->engineer_id === null)
                    && $logins->count() === 1;
                $login = $logins->first();
                $valid = $valid && $login !== null && strcasecmp($login->email, $account->email) === 0
                    && hash_equals($login->password, $account->password);
                if ($account->engineer_id !== null) {
                    $profile = $this->engineer((int) $account->engineer_id);
                    $valid = $valid && $profile->engineer_status === 'Active'
                        && ! DB::table('jairoads_next.user_accounts')->where('engineer_id', $account->engineer_id)->where('id', '!=', $id)->exists();
                }
                $fortify = $login === null ? null : User::query()->whereKey($login->id)->first();
                $valid = $valid && $fortify !== null && $resolver->canReactivate($fortify);
                if (! $valid) {
                    throw ValidationException::withMessages(['is_active' => 'Reactivation requires a valid Fortify link and an eligible active Engineer profile for linked accounts.']);
                }
            }
            DB::table('jairoads_next.user_accounts')->where('id', $id)->update(['is_active' => $active, 'updated_at' => now()]);
            $this->audit($actor, 'UserAccount', $id, $active ? 'Administrator reactivated account.' : 'Administrator deactivated account.', ['is_active' => ! $active], ['is_active' => $active], $active ? 'ACTIVATE' : 'DEACTIVATE');
        }, 3);

        return back()->with('dd_phase3_status', 'Account status saved.');
    }
}
