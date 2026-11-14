<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

/** Restrictive Final-DD deletion: rollback and concurrent child creation. */
final class RestrictiveProjectDeletionSafetyTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    public function test_audit_insert_failure_rolls_back_empty_project_deletion(): void
    {
        $f = $this->fixture();
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $token = $this->getJson($url.'/deletion-preview')->assertOk()->json('confirmation_token');

        DB::unprepared(<<<'SQL'
CREATE FUNCTION jairoads_next.reject_restrictive_delete_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.action = 'DELETE' AND NEW.entity_type = 'MaintenanceProject' THEN
        RAISE EXCEPTION 'Disposable audit failure';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER reject_restrictive_delete_audit
BEFORE INSERT ON jairoads_next.audit_logs
FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_restrictive_delete_audit();
SQL);

        $this->deleteJson($url, ['confirmation_token' => $token])->assertServerError();
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project'], 'road_coverage_id' => $f['road']]);
        $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $f['road']]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        Http::assertNothingSent();
    }

    public function test_database_delete_failure_keeps_empty_project_and_audit_unchanged(): void
    {
        $f = $this->fixture();
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $token = $this->getJson($url.'/deletion-preview')->assertOk()->json('confirmation_token');

        DB::unprepared(<<<'SQL'
CREATE FUNCTION jairoads_next.reject_restrictive_project_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Disposable project deletion failure';
END $$;
CREATE TRIGGER reject_restrictive_project_delete
BEFORE DELETE ON jairoads_next.maintenance_projects
FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_restrictive_project_delete();
SQL);

        $this->deleteJson($url, ['confirmation_token' => $token])->assertServerError();
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        Http::assertNothingSent();
    }

    public function test_concurrent_record_insert_prevents_empty_project_deletion(): void
    {
        $f = $this->fixture();
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $token = $this->getJson($url.'/deletion-preview')->assertOk()->json('confirmation_token');

        // The existing worker uses an independent DB connection. The test database
        // is explicitly disposable and the test bootstrap has already validated it.
        DB::commit();
        $worker = null;
        try {
            DB::beginTransaction();
            $this->assertNotNull(DB::table('jairoads_next.maintenance_projects')
                ->where('id', $f['project'])->lockForUpdate()->first());

            $worker = new Process([
                PHP_BINARY,
                __DIR__.'/preserved-history-worker.php',
                (string) $f['user']->id,
                $url,
                base64_encode(json_encode(['confirmation_token' => $token], JSON_THROW_ON_ERROR)),
                'DELETE',
            ]);
            $worker->setTimeout(30);
            $worker->start();

            $waiting = null;
            $deadline = microtime(true) + 12;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne("SELECT query FROM pg_stat_activity WHERE application_name='preserved_history_worker' AND wait_event_type='Lock'");
                if ($waiting !== null) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline && $worker->isRunning());

            $this->assertNotNull($waiting, $worker->getErrorOutput().$worker->getOutput());
            $this->assertStringContainsString('maintenance_projects', $waiting->query);

            $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
                $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]
            );
            DB::commit();
            $worker->wait();

            $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput().$worker->getOutput());
            $response = json_decode($worker->getOutput(), true, 512, JSON_THROW_ON_ERROR);
            $this->assertSame(409, $response['status']);
            $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
            $this->assertDatabaseHas('jairoads_next.maintenance_records', [
                'id' => $record, 'project_id' => $f['project'], 'managing_engineer_id' => $f['engineer'],
            ]);
            $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
            Http::assertNothingSent();
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            // This test intentionally commits fixtures to coordinate two real
            // connections. Clean up only inside the approved disposable DB.
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}
