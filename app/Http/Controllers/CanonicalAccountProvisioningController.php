<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesAndAuditsDirectory;
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
 * Canonical account provisioning; retains original atomic Fortify linkage,
 * authorization, locks, audit and validation, via the shared canonical directory helpers.
 */
final class CanonicalAccountProvisioningController extends Controller
{
    use AuthorizesAndAuditsDirectory;

    public function createAccount(Request $request, AccountIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $allowed = ['Admin', 'Engineer', 'Viewer'];
        $needsProfile = in_array($request->input('account_type'), ['Admin', 'Engineer'], true);
        $v = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'account_type' => ['required', Rule::in($allowed)],
            'engineer_id' => ['prohibited'],
            'profile' => [Rule::requiredIf($needsProfile), Rule::prohibitedIf(! $needsProfile), 'array:first_name,middle_name,last_name,contact_no,rank'],
            'profile.first_name' => [Rule::requiredIf($needsProfile), 'string', 'max:100'],
            'profile.middle_name' => ['nullable', 'string', 'max:100'],
            'profile.last_name' => [Rule::requiredIf($needsProfile), 'string', 'max:100'],
            'profile.contact_no' => [Rule::requiredIf($needsProfile), 'string', 'max:30'],
            'profile.rank' => [Rule::requiredIf($needsProfile), 'string', 'max:100'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $username = strtolower(trim((string) $v['username']));
        $email = strtolower(trim((string) $v['email']));
        $role = $v['account_type'];
        $engineerId = null;
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
                // New profile and both account identities commit or roll back together.
                // Only Admin and Engineer accounts receive a newly created active profile.
                if ($role !== 'Viewer') {
                    $profile = $v['profile'];
                    $profile['engineer_status'] = 'Active';
                    $engineerId = (int) DB::table('jairoads_next.engineers')->insertGetId($profile);
                    $this->audit($actor, 'CREATE', 'Engineer', $engineerId, 'Authorized administrator created an Engineer during account provisioning.', [
                        'engineer_id' => $engineerId, 'engineer_status' => 'Active',
                    ]);
                }
                $hashed = Hash::make((string) $v['password']);
                $canonicalId = (int) DB::table('jairoads_next.user_accounts')->insertGetId([
                    'username' => $username, 'email' => $email, 'password' => $hashed,
                    'account_type' => $role, 'engineer_id' => $engineerId,
                    'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                ]);
                // Keep public.users strictly as Fortify infrastructure; no legacy role FK.
                DB::table('public.users')->insert([
                    'name' => trim((string) $v['name']), 'email' => $email,
                    'password' => $hashed, 'user_account_id' => null,
                    'canonical_user_account_id' => $canonicalId,
                    'email_verified_at' => null, 'created_at' => now(), 'updated_at' => now(),
                ]);
                app(AccountProvisioning::class)->record($request->user(), $canonicalId);
                $this->audit($actor, 'CREATE', 'UserAccount', $canonicalId, 'Administrator provisioned a user account with an explicit Fortify link.', [
                    'account_type' => $role, 'engineer_id' => $engineerId, 'is_active' => true,
                ]);
            }, 2);
        } catch (QueryException) {
            throw ValidationException::withMessages(['account_type' => 'The database rejected account provisioning. No account or new profile was saved. Confirm the active UserAccount constraints and submitted values.']);
        }

        return redirect()->route('jairoads.workspace.show', ['section' => 'users'])->with('workspace_status', 'Account created.');
    }
}
