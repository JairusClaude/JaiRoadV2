<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

final class ConcurrentPeriodTest extends PostgresTestCase
{
    public function test_two_competing_http_requests_commit_one_period(): void
    {
        $f = $this->fixture();
        // Publish only disposable fixtures so independent PostgreSQL connections can see them.
        DB::commit();
        $processes = [];
        try {
            DB::beginTransaction();
            DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->lockForUpdate()->first();
            for ($i = 0; $i < 2; $i++) {
                $process = new Process([PHP_BINARY, __DIR__.'/concurrent-request.php', (string) $f['user']->id,
                    json_encode($this->recordData($f['project'], $f['engineer']), JSON_THROW_ON_ERROR)]);
                $process->setTimeout(15);
                $process->start();
                $processes[] = $process;
            }
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'quarterly_concurrency_worker' AND wait_event_type = 'Lock'")->n;
                if ($waiting === 2) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertSame(2, $waiting, 'Both requests must actually wait on the locked project. '.implode(' | ', array_map(fn ($p) => $p->getOutput().$p->getErrorOutput(), $processes)));
            DB::commit();
            $statuses = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
                $result = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
                $statuses[] = $result['status'];
            }
            sort($statuses);
            $this->assertSame([302, 422], $statuses);
            $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->where('project_id', $f['project'])->count());
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->whereNull('recipient_user_id')->count());
        } finally {
            foreach ($processes as $process) {
                $process->stop();
            }
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            // Guarded disposable test DB only; no real account/history is present here.
            DB::unprepared('TRUNCATE public.users, jairoads_next.user_accounts, jairoads_next.engineers, jairoads_next.lgus CASCADE');
        }
    }
}
