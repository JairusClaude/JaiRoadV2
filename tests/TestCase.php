<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    /** Explicit valid identity for authentication tests; never production provisioning. */
    protected function canonicalUser(User $user, string $role = 'SuperAdmin'): User
    {
        $db = DB::connection();
        if (getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY' || ! app()->environment('testing')
            || $db->getDriverName() !== 'pgsql' || ! in_array($db->getConfig('host'), ['localhost', '127.0.0.1'], true)
            || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', (string) $db->getConfig('database'))) {
            throw new \RuntimeException('Canonical auth fixtures require guarded disposable PostgreSQL.');
        }
        $root = null;
        $engineer = null;
        if ($role !== 'SuperAdmin') {
            $root = $this->canonicalUser(User::factory()->create());
            $engineer = $db->table('jairoads_next.engineers')->insertGetId([
                'first_name' => 'Synthetic', 'last_name' => 'Profile', 'rank' => 'Engineer I', 'engineer_status' => 'Active',
            ]);
        }
        $id = $db->table('jairoads_next.user_accounts')->insertGetId([
            'username' => 'fixture-'.$user->id, 'email' => $user->email, 'password' => $user->password,
            'account_type' => $role, 'is_active' => true, 'engineer_id' => $engineer,
        ]);
        $user->forceFill(['dd_user_account_id' => $id])->save();
        if ($root !== null) {
            $db->table('jairoads_security.account_provisioning')->insert([
                'user_account_id' => $id, 'provisioned_by' => $root->dd_user_account_id,
                'provisioner_role' => 'SuperAdmin', 'provisioned_role' => $role, 'engineer_id' => $engineer, 'method' => 'administrator',
            ]);
        }

        return $user;
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
