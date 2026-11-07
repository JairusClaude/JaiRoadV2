<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use SensitiveParameter;

/** Privileged CLI/operator service only, never bound to an HTTP route. */
final class TrustedSuperAdminBootstrap
{
    public function create(string $username, string $email, string $name, #[SensitiveParameter] string $password): int
    {
        abort_unless(DB::connection()->getDriverName() === 'pgsql', 503);
        $operator = DB::selectOne('SELECT rolsuper OR (rolcreaterole AND rolbypassrls) AS trusted FROM pg_roles WHERE rolname = current_user');
        abort_unless($operator !== null && $operator->trusted, 403, 'A privileged database operator is required.');
        $username = strtolower(trim($username));
        $email = strtolower(trim($email));
        Validator::make(compact('username', 'email', 'name', 'password'), [
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'email' => ['required', 'email:rfc', 'max:255'], 'name' => ['required', 'string', 'max:255'],
            'password' => ['required', Password::min(12)->mixedCase()->numbers()->symbols()],
        ])->validate();

        try {
            return DB::transaction(function () use ($username, $email, $name, $password): int {
                DB::select('SELECT pg_advisory_xact_lock(1927710916)');
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                abort_if(DB::table('jairoads_next.user_accounts')->where('account_type', 'SuperAdmin')->exists(), 409,
                    'A SuperAdmin already exists. Use the reviewed recovery procedure; do not bootstrap another.');
                $hash = Hash::make($password);
                $id = (int) DB::table('jairoads_next.user_accounts')->insertGetId([
                    'username' => $username, 'email' => $email, 'password' => $hash,
                    'account_type' => 'SuperAdmin', 'is_active' => true, 'engineer_id' => null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                DB::table('public.users')->insert([
                    'name' => trim($name), 'email' => $email, 'password' => $hash,
                    'dd_user_account_id' => $id, 'user_account_id' => null, 'email_verified_at' => null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);

                return $id;
            });
        } catch (QueryException) {
            // Do not leak SQL bindings containing credential hashes in command logs.
            throw new \RuntimeException('Bootstrap database write failed; neither account was committed.');
        }
    }
}
