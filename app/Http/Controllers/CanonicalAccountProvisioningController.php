<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\AccountIdentityResolver;
use App\Services\AccountProvisioning;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Canonical DD account provisioning; retains original atomic Fortify linkage,
 * authorization, locks, audit and validation, via DirectoryController helpers.
 */
final class CanonicalAccountProvisioningController extends DirectoryController
{
    public function createAccount(Request $request, AccountIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $allowed = ['Admin', 'Engineer', 'Viewer'];
        $v = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'account_type' => ['required', Rule::in($allowed)],
            'engineer_id' => ['required', 'integer', 'min:1'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $username = strtolower(trim((string) $v['username']));
        $email = strtolower(trim((string) $v['email']));
        $role = $v['account_type'];
        $engineerId = ! empty($v['engineer_id']) ? (int) $v['engineer_id'] : null;
        try {
            DB::transaction(function () use ($request, $resolver, $actor, $v, $username, $email, $role, $engineerId): void {
                DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                abort_unless($this->admin($request, $resolver) === $actor, 403);
                abort_unless(app(AccountProvisioning::class)->available(), 503, 'Account provisioning is unavailable pending schema-owner setup.');
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
                app(AccountProvisioning::class)->record($request->user(), $ddId);
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
