<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\LinkedPasswordUpdater;
use App\Services\OperationAudit;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

final class InternalPasswordRecoveryController extends Controller
{
    private const TABLE = 'jairoads_security.password_recovery_requests';

    private const ROLES = ['Admin', 'Engineer', 'Viewer'];

    private function available(): void
    {
        abort_unless(DB::connection()->getDriverName() === 'pgsql'
            && DB::selectOne('SELECT to_regclass(?) IS NOT NULL AS available', [self::TABLE])->available === true
            && is_string(config('app.key')) && config('app.key') !== '', 503, 'Internal recovery requires database-owner setup.');
    }

    private function reply(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'private, no-store');
    }

    private function administrator(Request $request, AccountIdentityResolver $resolver): array
    {
        $user = $request->user();
        $actor = $user instanceof User ? $resolver->resolve($user) : null;
        abort_unless($actor !== null && $actor['role'] === 'SuperAdmin', 403);

        return $actor;
    }

    private function target(string $identifier, AccountIdentityResolver $resolver, bool $lock = false): ?User
    {
        $column = str_contains($identifier, '@') ? 'email' : 'username';
        $account = DB::table('jairoads_next.user_accounts')->whereRaw('LOWER('.$column.') = ?', [strtolower(trim($identifier))])
            ->whereIn('account_type', self::ROLES)->limit(2)->get(['id']);
        if ($account->count() !== 1) {
            return null;
        }
        $query = User::query()->where('dd_user_account_id', $account->first()->id)->limit(2);
        $logins = ($lock ? $query->lockForUpdate() : $query)->get();
        if ($logins->count() !== 1) {
            return null;
        }
        $login = $logins->first();
        $identity = $resolver->resolveForRecovery($login);

        return $identity !== null && in_array($identity['role'], self::ROLES, true) ? $login : null;
    }

    private function digest(string $purpose, string $value): string
    {
        return hash_hmac('sha256', 'jairoads-internal-recovery-v1|'.$purpose.'|'.$value, (string) config('app.key'));
    }

    private function fingerprint(User $login): string
    {
        return $this->digest('credential', (string) $login->getKey().'|'.$login->getAuthPassword());
    }

    // Anonymous requests are never attributed to the target as authenticated audit events.
    // The request table itself records the request, approval and consumption timestamps.
    public function requestCode(Request $request, AccountIdentityResolver $resolver): JsonResponse
    {
        abort_unless($request->expectsJson(), 406);
        $this->available();
        $v = $request->validate(['identifier' => ['required', 'string', 'max:255']]);
        try {
            DB::transaction(function () use ($v, $resolver): void {
                DB::select('SELECT pg_advisory_xact_lock(1927710916)');
                $login = $this->target($v['identifier'], $resolver, true);
                if ($login === null) {
                    return;
                }
                $id = (int) $login->dd_user_account_id;
                DB::table(self::TABLE)->where('account_id', $id)->where('state', 'issued')->where('expires_at', '<=', now())
                    ->update(['state' => 'invalidated', 'code_digest' => null, 'credential_digest' => null]);
                $existing = DB::table(self::TABLE)->where('account_id', $id)
                    ->where('expires_at', '>', now())->whereIn('state', ['pending', 'issued'])->exists();
                if (! $existing) {
                    DB::table(self::TABLE)->insert([
                        'account_id' => $id, 'login_id' => $login->getKey(),
                        'state' => 'pending', 'attempts' => 0, 'requested_at' => now(),
                        'expires_at' => now()->addDay(),
                    ]);
                }
            }, 3);
        } catch (QueryException) {
            return $this->reply(['message' => 'Internal recovery is unavailable. Contact your SuperAdmin.'], 503);
        }

        return $this->reply(['message' => 'If the account is eligible, your request is available to the SuperAdmin. Verify your identity with them to receive a code.']);
    }

    public function index(Request $request, AccountIdentityResolver $resolver): JsonResponse
    {
        $this->administrator($request, $resolver);
        $this->available();
        $rows = DB::table(self::TABLE.' as r')->join('jairoads_next.user_accounts as a', 'a.id', '=', 'r.account_id')
            ->whereIn('a.account_type', self::ROLES)->where('a.is_active', true)
            ->where('r.state', 'pending')->where('r.expires_at', '>', now())
            ->orderBy('r.requested_at')->orderBy('r.id')->limit(100)
            ->get(['r.id', 'r.requested_at', 'a.username', 'a.email', 'a.account_type']);

        return $this->reply(['requests' => $rows]);
    }

    public function approve(Request $request, AccountIdentityResolver $resolver, int $id): JsonResponse
    {
        abort_unless($request->expectsJson(), 406);
        $actor = $this->administrator($request, $resolver);
        $this->available();
        $v = $request->validate([
            'current_password' => ['required', 'string', 'max:1024'],
            'identity_verified' => ['accepted'],
        ]);
        try {
            $code = DB::transaction(function () use ($request, $resolver, $actor, $v, $id): string {
                DB::select('SELECT pg_advisory_xact_lock(1927710916)');
                $admin = User::query()->whereKey($request->user()->getKey())->lockForUpdate()->first();
                abort_unless($admin instanceof User && $resolver->resolve($admin) === $actor, 403);
                if (! Hash::check($v['current_password'], $admin->getAuthPassword())) {
                    throw ValidationException::withMessages(['current_password' => 'Your SuperAdmin password is incorrect.']);
                }
                $row = DB::table(self::TABLE)->where('id', $id)->where('state', 'pending')
                    ->where('expires_at', '>', now())->lockForUpdate()->first();
                abort_unless($row !== null, 409, 'The request is no longer pending.');
                $login = User::query()->whereKey($row->login_id)->lockForUpdate()->first();
                $identity = $login instanceof User ? $resolver->resolveForRecovery($login) : null;
                abort_unless($identity !== null && $identity['account_id'] === (int) $row->account_id
                    && in_array($identity['role'], self::ROLES, true), 409, 'Account is not eligible for recovery.');
                $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                DB::table(self::TABLE)->where('id', $id)->update([
                    'state' => 'issued', 'approved_by' => $actor['account_id'], 'approved_at' => now(),
                    'expires_at' => now()->addMinutes(10), 'attempts' => 0,
                    'code_digest' => $this->digest('code', $id.'|'.$row->account_id.'|'.$code),
                    'credential_digest' => $this->fingerprint($login),
                ]);

                return $code;
            }, 3);
        } catch (QueryException) {
            return $this->reply(['message' => 'Approval could not be completed. No code was issued.'], 503);
        }

        // Only the approving administrator sees the plaintext code, once.
        return $this->reply(['code' => $code, 'expires_in_minutes' => 10]);
    }

    public function redeem(Request $request, AccountIdentityResolver $resolver, LinkedPasswordUpdater $passwords): JsonResponse
    {
        abort_unless($request->expectsJson(), 406);
        $this->available();
        $v = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'regex:/\A[0-9]{6}\z/'],
            'password' => ['required', 'string', 'max:72', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols(),
                static function ($attribute, $value, $fail): void {
                    if (is_string($value) && strlen($value) > 72) {
                        $fail('The password must not exceed 72 bytes.');
                    }
                }],
        ]);
        try {
            $ok = DB::transaction(function () use ($v, $resolver, $passwords): bool {
                DB::select('SELECT pg_advisory_xact_lock(1927710916)');
                $login = $this->target($v['identifier'], $resolver, true);
                if ($login === null) {
                    return false;
                }
                $row = DB::table(self::TABLE)->where('account_id', $login->dd_user_account_id)
                    ->where('login_id', $login->getKey())->where('state', 'issued')
                    ->where('expires_at', '>', now())->where('attempts', '<', 5)
                    ->orderByDesc('id')->lockForUpdate()->first();
                if ($row === null) {
                    return false;
                }
                $query = DB::table(self::TABLE)->where('id', $row->id);
                if (! hash_equals((string) $row->credential_digest, $this->fingerprint($login))) {
                    $query->update(['state' => 'invalidated', 'code_digest' => null, 'credential_digest' => null]);

                    return false;
                }
                if (! hash_equals((string) $row->code_digest, $this->digest('code', $row->id.'|'.$row->account_id.'|'.$v['code']))) {
                    $attempts = (int) $row->attempts + 1;
                    $query->update($attempts >= 5
                        ? ['attempts' => $attempts, 'state' => 'locked', 'code_digest' => null, 'credential_digest' => null]
                        : ['attempts' => $attempts]);

                    // Commit the failed attempt before returning a generic error.
                    return false;
                }
                $approver = User::query()->where('dd_user_account_id', $row->approved_by)->first();
                $actor = $approver instanceof User ? $resolver->resolve($approver) : null;
                if ($actor === null || $actor['role'] !== 'SuperAdmin') {
                    $query->update(['state' => 'invalidated', 'code_digest' => null, 'credential_digest' => null]);

                    return false;
                }
                $passwords->reset($login, $v['password']);
                $broker = (string) config('auth.defaults.passwords', 'users');
                DB::table(config('auth.passwords.'.$broker.'.table', 'password_reset_tokens'))
                    ->where('email', $login->getEmailForPasswordReset())->delete();
                $query->update(['state' => 'consumed', 'consumed_at' => now(), 'code_digest' => null, 'credential_digest' => null]);
                app(OperationAudit::class)->recordAdministratorPasswordReset($actor, (int) $row->account_id, internalCode: true);

                return true;
            }, 3);
        } catch (QueryException|ValidationException) {
            // Never expose SQL bindings, code digests, password values or account eligibility.
            $ok = false;
        }

        return $ok
            ? $this->reply(['message' => 'Password changed. Sign in using your new password.'])
            : $this->reply(['message' => 'Recovery could not be verified. Check the code or request a new one through your SuperAdmin.'], 422);
    }
}
