<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdActivityNotifications;
use App\Services\DataDictionary\DdRoleAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use stdClass;

/** Canonical lifecycle operations; retained rows and the current transactional audit writer. */
final class DdPeopleLifecycleController extends Controller
{
    /** @return array{account_id:int,role:string,engineer_id:?int} */
    private function admin(Request $request, DataDictionaryIdentityResolver $resolver): array
    {
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $actor = $resolver->resolve($login);
        abort_unless($actor !== null && DdRoleAccess::canManageAccounts($actor['role']), 403);

        return $actor;
    }

    /** @param array{account_id:int,role:string,engineer_id:?int} $actor */
    private function currentActor(array $actor, Request $request, DataDictionaryIdentityResolver $resolver): void
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
    private function audit(array $actor, string $entity, int $id, string $description, array $old, array $new): void
    {
        DB::table('jairoads_next.audit_logs')->insert([
            'user_id' => $actor['account_id'], 'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'],
            'action' => 'UPDATE', 'entity_type' => $entity, 'entity_id' => $id, 'description' => $description,
            'old_value' => json_encode($old, JSON_THROW_ON_ERROR), 'new_value' => json_encode($new, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null, 'notification_message' => null, 'created_at' => now(),
        ]);
        app(DdActivityNotifications::class)->record($actor, 'UPDATE', $entity, $id, $description);
    }

    public function updateEngineer(Request $request, DataDictionaryIdentityResolver $resolver, int $id): RedirectResponse
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

    public function retireEngineer(Request $request, DataDictionaryIdentityResolver $resolver, int $id): RedirectResponse
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
                // Match LinkedPasswordUpdater's login -> DD account -> Engineer lock order.
                DB::table('public.users')->where('dd_user_account_id', $accountId)->orderBy('id')->lockForUpdate()->get(['id']);
            }
            $account = $accountId === null ? null : DB::table('jairoads_next.user_accounts')->where('id', $accountId)->lockForUpdate()->first();
            $profile = $this->engineer($id);
            if ($account !== null && $this->active($account->is_active)) {
                $this->protectLastSuperAdmin($account);
                DB::table('jairoads_next.user_accounts')->where('id', $accountId)->update(['is_active' => false, 'updated_at' => now()]);
                $this->audit($actor, 'UserAccount', (int) $accountId, 'Linked account deactivated during Engineer retirement.', ['is_active' => true], ['is_active' => false]);
            }
            $assignments = DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $id)->where('is_active', true)->orderBy('lgu_id')->lockForUpdate()->get(['lgu_id']);
            foreach ($assignments as $assignment) {
                DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $id)->where('lgu_id', $assignment->lgu_id)->update(['is_active' => false]);
                $key = ['engineer_id' => $id, 'lgu_id' => (int) $assignment->lgu_id];
                $this->audit($actor, 'EngineerLGU', $id, 'LGU assignment deactivated during Engineer retirement.', $key + ['is_active' => true], $key + ['is_active' => false]);
            }
            if ($profile->engineer_status !== 'Retired') {
                DB::table('jairoads_next.engineers')->where('id', $id)->update(['engineer_status' => 'Retired']);
                $this->audit($actor, 'Engineer', $id, 'Administrator retired Engineer; historical references retained.', ['engineer_status' => $profile->engineer_status], ['engineer_status' => 'Retired']);
            }
        }, 3);

        return back()->with('dd_phase3_status', 'Engineer retired; linked account and active assignments deactivated.');
    }

    private function protectLastSuperAdmin(stdClass $account): void
    {
        if ($account->account_type === 'SuperAdmin' && $this->active($account->is_active)
            && DB::table('jairoads_next.user_accounts')->where('account_type', 'SuperAdmin')->where('is_active', true)->count() <= 1) {
            throw ValidationException::withMessages(['is_active' => 'Keep at least one active SuperAdmin account.']);
        }
    }

    public function accountDetails(Request $request, DataDictionaryIdentityResolver $resolver, int $id): JsonResponse
    {
        $this->admin($request, $resolver);
        $account = DB::table('jairoads_next.user_accounts')->where('id', $id)
            ->first(['id', 'username', 'email', 'account_type', 'engineer_id', 'is_active', 'created_at', 'updated_at']);
        abort_unless($account instanceof stdClass, 404);
        $engineer = $account->engineer_id === null ? null : DB::table('jairoads_next.engineers')->where('id', $account->engineer_id)
            ->first(['id', 'first_name', 'middle_name', 'last_name', 'contact_no', 'rank', 'engineer_status']);

        return response()->json(['account' => $account, 'engineer' => $engineer])->header('Cache-Control', 'private, no-store');
    }

    public function accountStatus(Request $request, DataDictionaryIdentityResolver $resolver, int $id): RedirectResponse
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
                $valid = DataDictionaryIdentityResolver::roleLinkValid($account->account_type, $account->engineer_id)
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
                if (! $valid) {
                    throw ValidationException::withMessages(['is_active' => 'Reactivation requires a valid Fortify link and an eligible active Engineer profile for linked accounts.']);
                }
            }
            DB::table('jairoads_next.user_accounts')->where('id', $id)->update(['is_active' => $active, 'updated_at' => now()]);
            $this->audit($actor, 'UserAccount', $id, $active ? 'Administrator reactivated account.' : 'Administrator deactivated account.', ['is_active' => ! $active], ['is_active' => $active]);
        }, 3);

        return back()->with('dd_phase3_status', 'Account status saved.');
    }
}
