<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

/** Synthetic accounts only; the existing empty-local-PG17 guard runs before any DDL. */
(new class('prepare') extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $users = [];
        foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
            $engineer = in_array($role, ['Admin', 'Engineer'], true) ? $this->engineer() : null;
            $user = $this->account($role, $engineer);
            $user->forceFill(['email_verified_at' => null])->save();
            $users[] = ['id' => (int) $user->id, 'email' => $user->email, 'role' => $role,
                'account_id' => (int) $user->dd_user_account_id, 'engineer_id' => $engineer];
        }
        // Existing legacy-only Eloquent login behavior is intentionally preserved.
        $legacy = User::forceCreate(['name' => 'Disposable legacy', 'email' => 'legacy-passkey@example.test', 'password' => Hash::make('Disposable-Test!123')]);
        $users[] = ['id' => (int) $legacy->id, 'email' => $legacy->email, 'role' => 'Legacy', 'account_id' => null, 'engineer_id' => null];
        DB::commit();
        echo json_encode(['users' => $users], JSON_THROW_ON_ERROR);
    }
})->prepare();
