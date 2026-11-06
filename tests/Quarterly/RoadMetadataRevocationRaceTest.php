<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

final class RoadMetadataRevocationRaceTest extends PostgresTestCase
{
    public function test_busy_lifecycle_authority_returns_conflict_without_an_inverse_lock_wait(): void
    {
        $f = $this->fixture();
        $before = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $audit = DB::table('jairoads_next.audit_logs')->get()->toJson();
        DB::commit();
        $worker = null;
        try {
            DB::beginTransaction();
            DB::select('SELECT pg_advisory_xact_lock(1927710916)');
            $worker = new Process([PHP_BINARY, __DIR__.'/monthly-concurrency-request.php', (string) $f['user']->id,
                'PUT', '/dd-phase3/ops/roads/'.$f['road'], json_encode([
                    'road_name' => 'Must not commit', 'lgu_id' => $before->lgu_id, 'kilometers' => $before->kilometers,
                    'pavement_type' => $before->pavement_type, 'state_category' => $before->state_category,
                ], JSON_THROW_ON_ERROR)]);
            $worker->setTimeout(5);
            // Must complete while the exclusive lifecycle guard is STILL held.
            // A blocking shared acquisition would time out/deadlock here.
            $worker->run();
            $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
            $this->assertSame(409, json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR)['status']);
            $this->assertEquals($before, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
            $this->assertSame($audit, DB::table('jairoads_next.audit_logs')->get()->toJson());
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::unprepared('TRUNCATE public.users, jairoads_next.user_accounts, jairoads_next.engineers, jairoads_next.lgus CASCADE');
        }
    }

    /** @return iterable<string,array{string,string}> */
    public static function cases(): iterable
    {
        foreach (['Admin', 'Engineer'] as $role) {
            foreach (['unchanged', 'deactivated'] as $change) {
                yield $role.' '.$change => [$role, $change];
            }
        }
        yield 'Engineer assignment revoked' => ['Engineer', 'unassigned'];
        yield 'Engineer retired' => ['Engineer', 'retired'];
    }

    #[DataProvider('cases')]
    public function test_waiting_metadata_save_requires_current_authority(string $role, string $change): void
    {
        $f = $this->fixture($role);
        $before = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $audit = DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();
        DB::commit(); // Publish only the guarded disposable fixtures to the HTTP worker.
        $worker = null;
        try {
            DB::beginTransaction();
            DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->lockForUpdate()->first();
            $worker = new Process([PHP_BINARY, __DIR__.'/monthly-concurrency-request.php', (string) $f['user']->id,
                'PUT', '/dd-phase3/ops/roads/'.$f['road'], json_encode([
                    'road_name' => 'Authorized metadata revision', 'lgu_id' => $before->lgu_id,
                    'kilometers' => $before->kilometers, 'pavement_type' => $before->pavement_type,
                    'state_category' => $before->state_category,
                ], JSON_THROW_ON_ERROR)]);
            $worker->setTimeout(20);
            $worker->start();
            $waiting = null;
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne("SELECT query FROM pg_stat_activity WHERE application_name = 'monthly_revocation_worker' AND wait_event_type = 'Lock'");
                if ($waiting !== null || ! $worker->isRunning()) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertNotNull($waiting, $worker->getOutput().$worker->getErrorOutput());
            $this->assertStringContainsString('road_coverages', $waiting->query);
            if ($change === 'deactivated' || $change === 'retired') {
                // Same exclusive lifecycle coordination as account status/retirement.
                DB::select('SELECT pg_advisory_xact_lock(1927710916)');
                DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
                if ($change === 'retired') {
                    DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['engineer_status' => 'Retired']);
                }
            } elseif ($change === 'unassigned') {
                // Match assignment administration: advisory key, profile, then assignment.
                DB::select('SELECT pg_advisory_xact_lock(1927710915)');
                DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->lockForUpdate()->first();
                DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $before->lgu_id)->update(['is_active' => false]);
            }
            DB::commit();
            $worker->wait();
            $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
            $response = json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            $after = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
            $this->assertSame($change === 'unchanged' ? 302 : 403, $response['status']);
            $this->assertSame($before->geojson, $after->geojson);
            $this->assertSame(1, DB::table('jairoads_next.maintenance_projects')->count());
            if ($change === 'unchanged') {
                $this->assertSame('Authorized metadata revision', $after->road_name);
                $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'RoadCoverage')->whereNull('recipient_user_id')->count());
            } else {
                $this->assertEquals($before, $after);
                $this->assertSame($audit, DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson());
            }
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::unprepared('TRUNCATE public.users, jairoads_next.user_accounts, jairoads_next.engineers, jairoads_next.lgus CASCADE');
        }
    }
}
