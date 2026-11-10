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
 * Canonical DD account provisioning; retains original atomic Fortify linkage,
 * authorization, locks, audit and validation, via the shared canonical directory helpers.
 */
final class CanonicalAccountProvisioningController extends Controller
{
    use AuthorizesAndAuditsDirectory;

    public function createAccount(Request $request, AccountIdentityResolver $resolver): RedirectResponse
    {
        $actor = $this->admin($request, $resolver);
        $allowed = ['Admin', 'Engineer', 'Viewer'];
        $v = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['exclude_unless:account_type,Viewer', 'required', 'string', 'max:255'],
            'account_type' => ['required', Rule::in($allowed)],
            // The server creates the profile; existing identities cannot be claimed.
            'engineer_id' => ['prohibited'],
            'first_name' => ['required_if:account_type,Admin,Engineer', 'prohibited_if:account_type,Viewer', 'string', 'max:100'],
            'middle_name' => ['nullable', 'prohibited_if:account_type,Viewer', 'string', 'max:100'],
            'last_name' => ['required_if:account_type,Admin,Engineer', 'prohibited_if:account_type,Viewer', 'string', 'max:100'],
            'contact_no' => ['required_if:account_type,Admin,Engineer', 'prohibited_if:account_type,Viewer', 'string', 'max:30'],
            'rank' => ['required_if:account_type,Admin,Engineer', 'prohibited_if:account_type,Viewer', 'string', 'max:100'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $username = strtolower(trim((string) $v['username']));
        $email = strtolower(trim((string) $v['email']));
        $role = $v['account_type'];
        try {
            DB::transaction(function () use ($request, $resolver, $actor, $v, $username, $email, $role): void {
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
                $engineerId = null;
                $name = trim((string) ($v['name'] ?? ''));
                if (in_array($role, ['Admin', 'Engineer'], true)) {
                    $profile = [];
                    foreach (['first_name', 'middle_name', 'last_name', 'contact_no', 'rank'] as $field) {
                        $value = preg_replace('/\s+/u', ' ', trim((string) ($v[$field] ?? '')));
                        $profile[$field] = $value === '' ? null : $value;
                    }
                    // Names alone are not a reliable person identifier. Reject only
                    // a matching full name AND nonempty normalized contact number.
                    $digits = preg_replace('/[^0-9]/', '', (string) $profile['contact_no']);
                    $duplicate = DB::table('jairoads_next.engineers');
                    foreach (['first_name', 'middle_name', 'last_name'] as $field) {
                        $duplicate->whereRaw("LOWER(regexp_replace(btrim(COALESCE({$field}, '')), '\\s+', ' ', 'g')) = ?", [mb_strtolower((string) $profile[$field])]);
                    }
                    if ($digits !== '' && $duplicate->whereRaw("regexp_replace(COALESCE(contact_no, ''), '[^0-9]', '', 'g') = ?", [$digits])->exists()) {
                        throw ValidationException::withMessages(['contact_no' => 'An Engineer with this full name and contact number already exists. Review that profile; no account was created.']);
                    }
                    $name = implode(' ', array_filter([$profile['first_name'], $profile['middle_name'], $profile['last_name']]));
                    if (mb_strlen($name) > 255) {
                        throw ValidationException::withMessages(['last_name' => 'The combined profile name must not exceed 255 characters.']);
                    }
                    $engineerId = (int) DB::table('jairoads_next.engineers')->insertGetId($profile + ['engineer_status' => 'Active']);
                }
                $hashed = Hash::make((string) $v['password']);
                $ddId = (int) DB::table('jairoads_next.user_accounts')->insertGetId([
                    'username' => $username, 'email' => $email, 'password' => $hashed,
                    'account_type' => $role, 'engineer_id' => $engineerId,
                    'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
                ]);
                // Keep public.users strictly as Fortify infrastructure; no legacy role FK.
                DB::table('public.users')->insert([
                    'name' => $name, 'email' => $email,
                    'password' => $hashed, 'user_account_id' => null,
                    'dd_user_account_id' => $ddId,
                    'email_verified_at' => null, 'created_at' => now(), 'updated_at' => now(),
                ]);
                app(AccountProvisioning::class)->record($request->user(), $ddId);
                if ($engineerId !== null) {
                    $this->audit($actor, 'CREATE', 'Engineer', $engineerId, 'Administrator created an Engineer profile during account provisioning.', ['engineer_status' => 'Active']);
                }
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
