<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

/** Real HTTP kernels on independent PostgreSQL connections; no authorization mocks. */
final class OrdinaryMutationRaceTest extends PostgresTestCase
{
    private function worker(User $user, string $method, string $url, array $data, string $name = 'ordinary_victim'): Process
    {
        $worker = new Process([PHP_BINARY, __DIR__.'/ordinary-concurrency-request.php', (string) $user->id,
            $method, $url, json_encode($data, JSON_THROW_ON_ERROR), $name]);
        $worker->setTimeout(20);
        $worker->start();

        return $worker;
    }

    private function waiting(Process $worker, string $name, array $needles, ?int $blocker = null): array
    {
        $pid = $blocker ?? (int) DB::selectOne('SELECT pg_backend_pid() AS id')->id;
        $deadline = microtime(true) + 8;
        do {
            DB::select('SELECT pg_stat_clear_snapshot()');
            $wait = DB::selectOne("SELECT pid, query, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE application_name = ? AND wait_event_type = 'Lock' AND ? = ANY(pg_blocking_pids(pid))", [$name, $pid]);
            if ($wait !== null) {
                $this->assertTrue(collect($needles)->contains(fn ($text) => str_contains($wait->query, $text)), $wait->query);

                return (array) $wait;
            }
            if (! $worker->isRunning()) {
                break;
            }
            usleep(20000);
        } while (microtime(true) < $deadline);
        $this->fail('No verified lock wait: '.$worker->getOutput().$worker->getErrorOutput());
    }

    private function workerStatus(Process $worker): int
    {
        $worker->wait();
        $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());

        return json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR)['status'];
    }

    private function snapshot(string $table): string
    {
        return DB::table('jairoads_next.'.$table)->orderBy($table === 'engineer_lgus' ? 'engineer_id' : 'id')
            ->when($table === 'engineer_lgus', fn ($q) => $q->orderBy('lgu_id'))->get()->toJson();
    }

    private function evidence(string $case, string $change, array $wait, int $status, bool $business, bool $audit, bool $delivery): void
    {
        $file = getenv('JAIROADS_RACE_EVIDENCE');
        if ($file) {
            file_put_contents($file, json_encode(['case' => $case, 'change' => $change, 'wait' => $wait,
                'status' => $status, 'business_changed' => $business, 'audit_changed' => $audit,
                'delivery_changed' => $delivery], JSON_THROW_ON_ERROR).PHP_EOL, FILE_APPEND | LOCK_EX);
        }
    }

    private function cleanupWorkers(array $workers): void
    {
        foreach ($workers as $worker) {
            $worker?->stop();
        }
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        PostgresTestSchema::clearCommittedFixtures();
    }

    private function lgu(): int
    {
        return (int) DB::table('jairoads_next.lgus')->insertGetId($this->lguData());
    }

    private function lguData(): array
    {
        return ['municipality_name' => 'Race municipality', 'province' => 'Test', 'region' => 'Test', 'mayor_first_name' => 'Test', 'mayor_middle_name' => null, 'mayor_last_name' => 'Mayor'];
    }

    public static function earlyCases(): iterable
    {
        foreach (['project_create', 'project_update', 'record_create', 'record_update', 'delete_road', 'delete_record', 'delete_update',
            'lgu_create', 'lgu_update', 'lgu_delete', 'engineer_create', 'assignment', 'settings'] as $case) {
            foreach (['unchanged', 'deactivated'] as $change) {
                yield $case.' '.$change => [$case, $change];
            }
        }
    }

    #[DataProvider('earlyCases')]
    public function test_initial_business_lock_wait_is_not_assumed_vulnerable(string $case, string $change): void
    {
        $f = $this->fixture('Admin');
        $revoker = $this->account('SuperAdmin');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $table = '';
        $key = null;
        $advisory = null;
        $tableLock = false;
        $method = 'POST';
        $url = '';
        $data = [];
        if (str_starts_with($case, 'project_')) {
            $table = 'maintenance_projects';
            $data = ['project_title' => 'Allowed project edit', 'road_coverage_id' => $f['road']];
            if ($case === 'project_create') {
                $data['road_coverage_id'] = $this->road($f['engineer']);
                $key = $data['road_coverage_id'];
                $lock = 'road_coverages';
            } else {
                $method = 'PUT';
                $key = $f['project'];
                $lock = $table;
            }
            $url = '/dd-phase3/ops/projects'.($method === 'PUT' ? '/'.$f['project'] : '');
        } elseif (str_starts_with($case, 'record_')) {
            $table = 'maintenance_records';
            $data = $this->recordData($f['project'], $f['engineer'], $case === 'record_create' ? 'Q2' : 'Q1') + ['ignored_creator' => 99999];
            $data['description'] = 'Allowed record edit';
            $method = $case === 'record_create' ? 'POST' : 'PUT';
            $url = '/dd-phase3/ops/records'.($method === 'PUT' ? '/'.$record : '');
            $lock = $method === 'POST' ? 'maintenance_projects' : $table;
            $key = $method === 'POST' ? $f['project'] : $record;
        } elseif (str_starts_with($case, 'delete_')) {
            $method = 'DELETE';
            if ($case === 'delete_road') {
                $table = 'road_coverages';
                $key = $this->road($f['engineer']);
                $entity = 'roads';
            } elseif ($case === 'delete_record') {
                $table = 'maintenance_records';
                $key = $record;
                $entity = 'records';
            } else {
                $table = 'monthly_updates';
                $key = (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
                $entity = 'updates';
            }
            $lock = $table;
            $url = '/dd-phase3/ops/'.$entity.'/'.$key;
        } elseif (str_starts_with($case, 'lgu_')) {
            $table = $lock = 'lgus';
            $data = $this->lguData();
            $data['municipality_name'] = 'Allowed municipal edit';
            $method = match ($case) {
                'lgu_create' => 'POST', 'lgu_update' => 'PUT', default => 'DELETE'
            };
            $tableLock = $method === 'POST';
            $key = $tableLock ? null : $this->lgu();
            $url = '/dd-phase3/lgus'.($key === null ? '' : '/'.$key);
        } elseif ($case === 'engineer_create') {
            $table = $lock = 'engineers';
            $tableLock = true;
            $url = '/dd-phase3/engineers';
            $data = ['first_name' => 'New', 'middle_name' => null, 'last_name' => 'Engineer', 'rank' => 'Engineer II', 'contact_no' => '09000000000'];
        } elseif ($case === 'assignment') {
            $table = 'engineer_lgus';
            $advisory = 1927710915;
            $lock = '1927710915';
            $url = '/dd-phase3/assignments';
            $data = ['engineer_id' => $f['engineer'], 'lgu_id' => (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id'), 'is_active' => false];
        } else {
            $table = 'user_accounts';
            $lock = '1927710963';
            $advisory = 1927710963;
            $method = 'PUT';
            $url = '/dd-phase3/ops/settings';
            $data = ['username' => 'allowed.changed', 'current_password' => 'Disposable-Test!123'];
        }
        DB::commit();
        $worker = null;
        try {
            DB::beginTransaction();
            if ($advisory !== null) {
                DB::select('SELECT pg_advisory_xact_lock(?)', [$advisory]);
            } elseif ($tableLock) {
                DB::statement('LOCK TABLE jairoads_next.'.$lock.' IN SHARE MODE');
            } else {
                DB::table('jairoads_next.'.$lock)->where('id', $key)->lockForUpdate()->first();
            }
            $worker = $this->worker($f['user'], $method, $url, $data);
            $wait = $this->waiting($worker, 'ordinary_victim', [$lock]);
            if ($change === 'deactivated') {
                $this->withSession(['password_hash_web' => null])->actingAs($revoker)
                    ->patchJson('/dd-phase3/accounts/'.$f['user']->dd_user_account_id.'/status', ['is_active' => false])->assertRedirect();
            }
            $before = $this->snapshot($table);
            $audit = $this->snapshot('audit_logs');
            $delivery = $this->snapshot('audit_notification_recipients');
            DB::commit();
            $status = $this->workerStatus($worker);
            $business = $before !== $this->snapshot($table);
            $audited = $audit !== $this->snapshot('audit_logs');
            $delivered = $delivery !== $this->snapshot('audit_notification_recipients');
            $this->evidence($case, $change, $wait, $status, $business, $audited, $delivered);
            $this->assertSame($change === 'unchanged' ? 302 : 403, $status);
            $this->assertSame($change === 'unchanged', $business);
            $this->assertSame($change === 'unchanged', $audited);
            $this->assertSame($change === 'unchanged', $delivered);
        } finally {
            $this->cleanupWorkers([$worker]);
        }
    }

    public static function lateCases(): iterable
    {
        foreach (['record_update', 'record_retired_manager', 'monthly_create', 'monthly_update'] as $case) {
            foreach (['unchanged', 'unassigned'] as $change) {
                yield $case.' '.$change => [$case, $change];
            }
        }
    }

    #[DataProvider('lateCases')]
    public function test_late_wait_cannot_preserve_revoked_engineer_lgu_authority(string $case, string $change): void
    {
        $f = $this->fixture($case === 'record_retired_manager' ? 'Admin' : 'Engineer');
        $revoker = $this->account('SuperAdmin');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $table = in_array($case, ['record_update', 'record_retired_manager'], true) ? 'maintenance_records' : 'monthly_updates';
        $id = $case === 'monthly_update' ? (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]) : null;
        $method = $case === 'monthly_create' ? 'POST' : 'PUT';
        $url = in_array($case, ['record_update', 'record_retired_manager'], true) ? '/dd-phase3/ops/records/'.$record : '/dd-phase3/ops/updates'.($id === null ? '' : '/'.$id);
        $data = in_array($case, ['record_update', 'record_retired_manager'], true) ? $this->recordData($f['project'], $f['engineer']) : ['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 40, 'summary_of_text_reports' => 'Allowed report edit'];
        $data['description'] = 'Allowed record edit';
        DB::commit();
        $worker = null;
        try {
            DB::beginTransaction();
            if (in_array($case, ['record_update', 'record_retired_manager'], true)) {
                DB::table('jairoads_next.maintenance_records')->where('id', $record)->lockForUpdate()->first();
            } else {
                DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->lockForUpdate()->first();
            }
            $worker = $this->worker($f['user'], $method, $url, $data);
            // Baseline monthly waits at its audit FK; repaired code may wait earlier on pinned account authority.
            $wait = $this->waiting($worker, 'ordinary_victim', in_array($case, ['record_update', 'record_retired_manager'], true) ? ['maintenance_records'] : ['monthly_updates', 'audit_logs', 'user_accounts']);
            if ($change === 'unassigned' && $case === 'record_retired_manager') {
                $this->withSession(['password_hash_web' => null])->actingAs($revoker)->postJson('/dd-phase3/engineers/'.$f['engineer'].'/retirement')->assertRedirect();
            } elseif ($change === 'unassigned') {
                $this->withSession(['password_hash_web' => null])->actingAs($revoker)->postJson('/dd-phase3/assignments', ['engineer_id' => $f['engineer'], 'lgu_id' => $lgu, 'is_active' => false])->assertRedirect();
            }
            $before = $this->snapshot($table);
            $audit = $this->snapshot('audit_logs');
            $delivery = $this->snapshot('audit_notification_recipients');
            DB::commit();
            $status = $this->workerStatus($worker);
            $business = $before !== $this->snapshot($table);
            $audited = $audit !== $this->snapshot('audit_logs');
            $delivered = $delivery !== $this->snapshot('audit_notification_recipients');
            $this->evidence($case.' late', $change, $wait, $status, $business, $audited, $delivered);
            $this->assertSame($change === 'unchanged' ? 302 : ($case === 'record_retired_manager' ? 422 : 403), $status, json_encode([$business, $audited, $delivered]));
            $this->assertSame($change === 'unchanged', $business);
            $this->assertSame($change === 'unchanged', $audited);
            $this->assertSame($change === 'unchanged', $delivered);
        } finally {
            $this->cleanupWorkers([$worker]);
        }
    }

    public static function provisionControls(): iterable
    {
        yield [false];
        yield [true];
    }

    #[DataProvider('provisionControls')]
    public function test_existing_provisioning_lifecycle_guard_serializes_account_deactivation(bool $revoke): void
    {
        $f = $this->fixture();
        $revoker = $this->account('SuperAdmin');
        $target = $this->engineer();
        DB::commit();
        $worker = $revocation = null;
        try {
            DB::beginTransaction();
            DB::select('SELECT pg_advisory_xact_lock(1927710914)');
            $worker = $this->worker($f['user'], 'POST', '/dd-phase3/accounts', ['username' => 'race.provisioned', 'name' => 'Disposable provision', 'email' => 'race-provisioned@example.test',
                'account_type' => 'Viewer', 'engineer_id' => $target, 'password' => 'New-Account!12345', 'password_confirmation' => 'New-Account!12345']);
            $wait = $this->waiting($worker, 'ordinary_victim', ['1927710914']);
            if ($revoke) {
                $revocation = $this->worker($revoker, 'PATCH', '/dd-phase3/accounts/'.$f['user']->dd_user_account_id.'/status', ['is_active' => false], 'ordinary_revoker');
                $wait['revocation_wait'] = $this->waiting($revocation, 'ordinary_revoker', ['1927710916'], (int) $wait['pid']);
                $this->assertTrue(DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->value('is_active'));
            }
            DB::commit();
            $status = $this->workerStatus($worker);
            $this->assertSame(302, $status);
            if ($revocation !== null) {
                $this->assertSame(302, $this->workerStatus($revocation));
            }
            $this->assertDatabaseHas('jairoads_next.user_accounts', ['username' => 'race.provisioned', 'account_type' => 'Viewer', 'engineer_id' => $target]);
            $this->assertDatabaseHas('public.users', ['email' => 'race-provisioned@example.test']);
            $this->assertSame(! $revoke, DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->value('is_active'));
            $this->evidence('account_provisioning', $revoke ? 'revocation_serialized_after_commit' : 'unchanged', $wait, $status, true, true, true);
        } finally {
            $this->cleanupWorkers([$worker, $revocation]);
        }
    }

    public static function commitWindows(): iterable
    {
        yield ['project'];
        yield ['record'];
        yield ['monthly'];
    }

    #[DataProvider('commitWindows')]
    public function test_lgu_authority_is_pinned_during_final_notification_wait(string $case): void
    {
        $f = $this->fixture('Engineer');
        $revoker = $this->account('SuperAdmin');
        $road = $case === 'project' ? $this->road($f['engineer']) : $f['road'];
        $lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $road)->value('lgu_id');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $method = $case === 'record' ? 'PUT' : 'POST';
        $url = match ($case) {
            'project' => '/dd-phase3/ops/projects', 'record' => '/dd-phase3/ops/records/'.$record, default => '/dd-phase3/ops/updates'
        };
        $data = match ($case) {
            'project' => ['project_title' => 'Commit-safe project', 'road_coverage_id' => $road],
            'record' => array_replace($this->recordData($f['project'], $f['engineer']), ['description' => 'Commit-safe edit']),
            default => ['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 40],
        };
        DB::commit();
        $worker = $revocation = null;
        try {
            DB::beginTransaction();
            // Hold a recipient FK, after the victim has finalized business authority.
            DB::table('jairoads_next.user_accounts')->where('id', $revoker->dd_user_account_id)->lockForUpdate()->first();
            $worker = $this->worker($f['user'], $method, $url, $data);
            $wait = $this->waiting($worker, 'ordinary_victim', ['audit_notification_recipients']);
            $revocation = $this->worker($revoker, 'POST', '/dd-phase3/assignments', ['engineer_id' => $f['engineer'], 'lgu_id' => $lgu, 'is_active' => false], 'ordinary_revoker');
            $wait['revocation_wait'] = $this->waiting($revocation, 'ordinary_revoker', ['engineers'], (int) $wait['pid']);
            $this->assertTrue(DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $lgu)->value('is_active'));
            DB::commit();
            $this->assertSame(302, $this->workerStatus($worker));
            $this->assertSame(302, $this->workerStatus($revocation));
            $this->assertFalse(DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $lgu)->value('is_active'));
            $events = DB::table('jairoads_next.audit_logs')->orderBy('id')->get();
            $this->assertSame($case === 'project' ? 'MaintenanceProject' : ($case === 'record' ? 'MaintenanceRecord' : 'MonthlyUpdate'), $events[0]->entity_type);
            $this->assertSame('EngineerLGU', $events[1]->entity_type);
            $this->assertCount(2, $events);
            if ($case === 'project') {
                $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['project_title' => 'Commit-safe project']);
            } elseif ($case === 'record') {
                $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $record, 'description' => 'Commit-safe edit']);
            } else {
                $this->assertDatabaseHas('jairoads_next.monthly_updates', ['maintenance_id' => $record, 'progress_percentage' => 40]);
            }
            $this->evidence($case.' commit window', 'revocation_serialized_after_commit', $wait, 302, true, true, true);
        } finally {
            $this->cleanupWorkers([$worker, $revocation]);
        }
    }

    public static function busyPaths(): iterable
    {
        yield ['record'];
        yield ['monthly'];
    }

    #[DataProvider('busyPaths')]
    public function test_busy_lifecycle_does_not_create_an_inverse_parent_lock_wait(string $case): void
    {
        $f = $this->fixture('Engineer');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $method = $case === 'record' ? 'PUT' : 'POST';
        $url = $case === 'record' ? '/dd-phase3/ops/records/'.$record : '/dd-phase3/ops/updates';
        $data = $case === 'record' ? array_replace($this->recordData($f['project'], $f['engineer']), ['description' => 'Allowed after retry']) : ['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 40];
        DB::commit();
        $worker = null;
        try {
            DB::beginTransaction();
            DB::select('SELECT pg_advisory_xact_lock(1927710916)');
            $before = $this->snapshot($case === 'record' ? 'maintenance_records' : 'monthly_updates');
            $worker = $this->worker($f['user'], $method, $url, $data);
            $worker->setTimeout(5);
            $this->assertSame(409, $this->workerStatus($worker)); // Must finish while exclusivity is still held.
            $this->assertSame($before, $this->snapshot($case === 'record' ? 'maintenance_records' : 'monthly_updates'));
            $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
            $this->assertSame(0, DB::table('jairoads_next.audit_notification_recipients')->count());
            DB::commit();
            $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->json($method, $url, $data)->assertRedirect();
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
        } finally {
            $this->cleanupWorkers([$worker]);
        }
    }

    #[DataProvider('busyPaths')]
    public function test_failed_audit_rolls_back_and_releases_record_authority(string $case): void
    {
        $f = $this->fixture('Engineer');
        $revoker = $this->account('SuperAdmin');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $method = $case === 'record' ? 'PUT' : 'POST';
        $url = $case === 'record' ? '/dd-phase3/ops/records/'.$record : '/dd-phase3/ops/updates';
        $data = $case === 'record' ? array_replace($this->recordData($f['project'], $f['engineer']), ['description' => 'Must roll back']) : ['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 40];
        $before = $this->snapshot($case === 'record' ? 'maintenance_records' : 'monthly_updates');
        DB::commit();
        $worker = null;
        try {
            DB::unprepared("CREATE FUNCTION jairoads_next.ordinary_race_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type IN ('MaintenanceRecord', 'MonthlyUpdate') THEN RAISE EXCEPTION 'Disposable audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ordinary_race_fail_audit BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.ordinary_race_fail_audit()");
            $this->json($method, $url, $data)->assertServerError();
            $this->assertSame($before, $this->snapshot($case === 'record' ? 'maintenance_records' : 'monthly_updates'));
            $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
            $this->assertSame(0, DB::table('jairoads_next.audit_notification_recipients')->count());
            $worker = $this->worker($revoker, 'POST', '/dd-phase3/assignments', ['engineer_id' => $f['engineer'], 'lgu_id' => $lgu, 'is_active' => false], 'ordinary_revoker');
            $worker->setTimeout(5); // A leaked lifecycle/profile/membership lock would time out.
            $this->assertSame(302, $this->workerStatus($worker));
            $this->assertSame('EngineerLGU', DB::table('jairoads_next.audit_logs')->sole()->entity_type);
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::unprepared('DROP TRIGGER IF EXISTS ordinary_race_fail_audit ON jairoads_next.audit_logs; DROP FUNCTION IF EXISTS jairoads_next.ordinary_race_fail_audit()');
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}
