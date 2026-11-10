<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

final class PostDemoAccountCreationTest extends PostgresTestCase
{
    private function input(string $type = 'Engineer'): array
    {
        return ['username' => 'postdemo-new', 'email' => 'postdemo@example.test', 'account_type' => $type,
            'password' => 'PostDemo-Secure!123', 'password_confirmation' => 'PostDemo-Secure!123',
            ...($type === 'Viewer' ? ['name' => 'Independent Viewer'] : ['first_name' => 'New', 'middle_name' => 'Test',
                'last_name' => 'Professional', 'contact_no' => '+63 900 123 4567', 'rank' => 'Engineer II'])];
    }

    public static function creations(): iterable
    {
        foreach (['Admin', 'SuperAdmin'] as $actor) {
            foreach (['Admin', 'Engineer', 'Viewer'] as $role) {
                yield $actor.' -> '.$role => [$actor, $role];
            }
        }
    }

    #[DataProvider('creations')]
    public function test_role_specific_creation_and_real_password_login(string $actor, string $role): void
    {
        $creator = $this->account($actor);
        $beforeProfiles = DB::table('jairoads_next.engineers')->get()->toJson();
        $beforeCount = DB::table('jairoads_next.engineers')->count();
        $this->actingAs($creator)->postJson('/dd-phase3/accounts', $this->input($role))->assertRedirect();
        $account = DB::table('jairoads_next.user_accounts')->where('username', 'postdemo-new')->first();
        $login = User::where('dd_user_account_id', $account->id)->firstOrFail();
        $this->assertSame($role, $account->account_type);
        $this->assertSame($role === 'Viewer', $account->engineer_id === null);
        $this->assertSame($beforeCount + ($role === 'Viewer' ? 0 : 1), DB::table('jairoads_next.engineers')->count());
        if ($role === 'Viewer') {
            $this->assertSame($beforeProfiles, DB::table('jairoads_next.engineers')->get()->toJson());
        } else {
            $this->assertDatabaseHas('jairoads_next.engineers', ['id' => $account->engineer_id, 'engineer_status' => 'Active', 'rank' => 'Engineer II']);
        }
        $this->assertSame(0, DB::table('jairoads_next.engineer_lgus')->count());
        $this->assertSame($account->password, $login->password);
        $this->assertNull($login->email_verified_at);
        $this->assertDatabaseHas('jairoads_security.account_provisioning', ['user_account_id' => $account->id, 'provisioned_by' => $creator->dd_user_account_id, 'engineer_id' => $account->engineer_id]);
        $this->assertSame($role === 'Viewer' ? 1 : 2, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'UserAccount')->count());
        $audit = DB::table('jairoads_next.audit_logs')->get()->toJson();
        $this->assertStringNotContainsString($account->password, $audit);
        $this->assertStringNotContainsString('PostDemo-Secure!123', $audit);
        $this->postJson('/logout')->assertNoContent();
        $this->postJson('/login', ['email' => $login->email, 'password' => 'PostDemo-Secure!123'])->assertOk();
        $this->assertSame($role, app(AccountIdentityResolver::class)->resolve($login)['role']);
        if ($role === 'Viewer') {
            $this->postJson('/dd-phase3/ops/projects', [])->assertForbidden();
        }
        if ($role === 'Engineer') {
            $road = $this->road();
            $this->postJson('/dd-phase3/ops/projects', ['road_coverage_id' => $road, 'project_title' => 'No LGU grant'])->assertForbidden();
        }
    }

    public static function failures(): iterable
    {
        foreach (['jairoads_next.engineers', 'jairoads_next.user_accounts', 'public.users',
            'jairoads_security.account_provisioning', 'jairoads_next.audit_logs', 'jairoads_next.audit_notification_recipients'] as $table) {
            yield [$table];
        }
    }

    #[DataProvider('failures')]
    public function test_every_required_write_failure_rolls_back_all_entities_and_history(string $table): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $tables = ['jairoads_next.engineers', 'jairoads_next.user_accounts', 'public.users', 'jairoads_security.account_provisioning', 'jairoads_next.audit_logs', 'jairoads_next.audit_notification_recipients'];
        $before = array_map(fn ($t) => DB::table($t)->get()->toJson(), $tables);
        DB::connection()->beforeExecuting(static function (string $query) use ($table): void {
            [$schema, $name] = explode('.', $table);
            if (str_starts_with($query, 'insert into "'.$schema.'"."'.$name.'"')) {
                throw new \RuntimeException('Disposable required write failure');
            }
        });
        $this->postJson('/dd-phase3/accounts', $this->input())->assertServerError();
        $this->assertSame($before, array_map(fn ($t) => DB::table($t)->get()->toJson(), $tables));
    }

    public static function invalidFields(): iterable
    {
        foreach (['first_name', 'last_name', 'contact_no', 'rank', 'engineer_id', 'viewer_rank'] as $field) {
            yield [$field];
        }
    }

    #[DataProvider('invalidFields')]
    public function test_invalid_profile_fields_cannot_create_partial_records(string $field): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $data = $this->input();
        if ($field === 'engineer_id') {
            $data['engineer_id'] = 1;
        } elseif ($field === 'viewer_rank') {
            $data = $this->input('Viewer') + ['rank' => 'Admin'];
        } else {
            unset($data[$field]);
        }
        $this->postJson('/dd-phase3/accounts', $data)->assertUnprocessable()->assertJsonValidationErrors($field === 'viewer_rank' ? 'rank' : $field);
        $this->assertSame(0, DB::table('jairoads_next.engineers')->count());
        $this->assertSame(1, DB::table('public.users')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_duplicate_credentials_and_reliable_person_conflicts_leave_no_orphans(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $this->postJson('/dd-phase3/accounts', $this->input())->assertRedirect();
        foreach (['username', 'email', 'person'] as $duplicate) {
            $data = $this->input();
            if ($duplicate !== 'username') {
                $data['username'] = 'other-account';
            }
            if ($duplicate !== 'email') {
                $data['email'] = 'other@example.test';
            }
            $this->postJson('/dd-phase3/accounts', $data)->assertUnprocessable()->assertJsonValidationErrors($duplicate === 'person' ? 'contact_no' : $duplicate);
        }
        $this->assertSame(1, DB::table('jairoads_next.engineers')->count());
        $this->assertSame(2, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_existing_normalized_person_is_not_claimed_and_same_name_alone_is_allowed(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $existing = $this->engineer();
        DB::table('jairoads_next.engineers')->where('id', $existing)->update([
            'first_name' => ' new ', 'middle_name' => ' TEST ', 'last_name' => 'PROFESSIONAL',
            'contact_no' => '+63-900-123-4567', 'engineer_status' => 'Retired',
        ]);
        $before = DB::table('jairoads_next.engineers')->where('id', $existing)->first();
        $this->postJson('/dd-phase3/accounts', $this->input())->assertUnprocessable()->assertJsonValidationErrors('contact_no');
        $this->assertSame(1, DB::table('jairoads_next.engineers')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->postJson('/dd-phase3/accounts', array_replace($this->input(), ['contact_no' => '09199999999']))->assertRedirect();
        $this->assertEquals($before, DB::table('jairoads_next.engineers')->where('id', $existing)->first());
        $this->assertNotSame($existing, (int) DB::table('jairoads_next.user_accounts')->where('username', 'postdemo-new')->value('engineer_id'));
    }

    public function test_success_preserves_existing_linked_viewer_accounts_and_audit_history(): void
    {
        $root = $this->account('SuperAdmin');
        $this->account('Viewer', $this->engineer());
        $this->actingAs($root)->postJson('/dd-phase3/lgus', [
            'municipality_name' => 'Historical municipality', 'province' => 'Test province', 'region' => 'Test region',
            'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor',
        ])->assertRedirect();
        $tables = ['jairoads_next.engineers', 'jairoads_next.user_accounts', 'public.users',
            'jairoads_security.account_provisioning', 'jairoads_next.audit_logs', 'jairoads_next.audit_notification_recipients'];
        $before = [];
        foreach ($tables as $table) {
            $before[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
        }
        $this->postJson('/dd-phase3/accounts', $this->input())->assertRedirect();
        foreach ($before as $table => $rows) {
            foreach ($rows as $row) {
                $this->assertEquals($row, (array) DB::table($table)->where($table === 'jairoads_security.account_provisioning' ? 'user_account_id' : 'id', $row[$table === 'jairoads_security.account_provisioning' ? 'user_account_id' : 'id'])->first());
            }
        }
    }

    public static function deniedRoles(): iterable
    {
        yield ['Engineer'];
        yield ['Viewer'];
    }

    #[DataProvider('deniedRoles')]
    public function test_engineer_and_viewer_cannot_provision_any_account(string $role): void
    {
        $this->actingAs($this->account($role))->postJson('/dd-phase3/accounts', $this->input())->assertForbidden();
        $this->assertDatabaseMissing('jairoads_next.user_accounts', ['username' => 'postdemo-new']);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_real_concurrent_duplicate_submissions_create_one_profile_and_account(): void
    {
        $actor = $this->account('SuperAdmin');
        DB::commit();
        $workers = [];
        try {
            DB::beginTransaction();
            DB::select('SELECT pg_advisory_xact_lock(1927710914)');
            $blocker = (int) DB::selectOne('SELECT pg_backend_pid() AS id')->id;
            for ($i = 0; $i < 2; $i++) {
                $worker = new Process([PHP_BINARY, __DIR__.'/ordinary-concurrency-request.php', (string) $actor->id, 'POST', '/dd-phase3/accounts', json_encode($this->input(), JSON_THROW_ON_ERROR)]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 8;
            $waiting = 0;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name='ordinary_victim' AND wait_event_type='Lock' AND ? = ANY(pg_blocking_pids(pid))", [$blocker])->n;
                if ($waiting === 2) {
                    break;
                } usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertSame(2, $waiting, 'Both requests must demonstrably wait on the real provisioning lock.');
            DB::commit();
            $statuses = [];
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
                $statuses[] = json_decode($worker->getOutput(), true)['status'];
            }
            sort($statuses);
            $this->assertSame([302, 422], $statuses);
            $this->assertSame(1, DB::table('jairoads_next.engineers')->count());
            $this->assertSame(2, DB::table('jairoads_next.user_accounts')->count());
            $this->assertSame(2, DB::table('public.users')->count());
            $this->assertSame(1, DB::table('jairoads_security.account_provisioning')->count());
            $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count());
            $this->assertSame(2, DB::table('jairoads_next.audit_notification_recipients')->count());
        } finally {
            foreach ($workers as $worker) {
                $worker->stop();
            }
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}
