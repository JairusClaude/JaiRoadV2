<?php

use App\Models\User;
use App\Services\DataDictionary\TrustedSuperAdminBootstrap;
use Illuminate\Support\Facades\DB;
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
            $engineer = $role !== 'SuperAdmin' ? $this->engineer() : null;
            if ($role === 'SuperAdmin') {
                $id = app(TrustedSuperAdminBootstrap::class)->create('passkey-root', 'passkey-root@example.test', 'Bootstrap root', 'Disposable-Test!123');
                $user = User::where('dd_user_account_id', $id)->firstOrFail();
            } else {
                $user = $this->account($role, $engineer);
            }
            $user->forceFill(['email_verified_at' => null])->save();
            $users[] = ['id' => (int) $user->id, 'email' => $user->email, 'role' => $role,
                'account_id' => (int) $user->dd_user_account_id, 'engineer_id' => $engineer];
        }
        // Register a real key while eligible, then detach only this synthetic
        // bridge to test a fully signed legacy-only assertion without a bypass.
        $legacy = $this->account('Viewer');
        $legacyAccount = DB::table('jairoads_next.user_accounts')->where('id', $legacy->dd_user_account_id)->first();
        $users[] = ['id' => (int) $legacy->id, 'email' => $legacy->email, 'role' => 'Legacy',
            'account_id' => (int) $legacy->dd_user_account_id, 'engineer_id' => (int) $legacyAccount->engineer_id];
        DB::commit();
        echo json_encode(['users' => $users], JSON_THROW_ON_ERROR);
    }
})->prepare();
