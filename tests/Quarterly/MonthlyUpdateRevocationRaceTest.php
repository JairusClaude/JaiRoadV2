<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

final class MonthlyUpdateRevocationRaceTest extends PostgresTestCase
{
    /** @return iterable<string,array{string,string}> */
    public static function cases(): iterable
    {
        foreach (['POST', 'PUT'] as $method) {
            foreach (['unchanged', 'deactivated', 'unassigned', 'reassigned'] as $change) {
                yield $method.' '.$change => [$method, $change];
            }
        }
    }

    #[DataProvider('cases')]
    public function test_waiting_monthly_save_rechecks_current_authority(string $method, string $change): void
    {
        $f = $this->fixture('Engineer');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $replacement = $this->engineer();
        $this->account('Engineer', $replacement);
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => true]);
        $id = $method === 'PUT' ? (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10,
            'summary_of_text_reports' => 'Preserved report', 'created_by' => $f['user']->dd_user_account_id]) : null;
        $before = DB::table('jairoads_next.monthly_updates')->orderBy('id')->get()->toJson();
        $audit = DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();
        DB::commit(); // Guarded disposable fixture, visible to a second connection.
        $worker = null;
        try {
            DB::beginTransaction();
            DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->lockForUpdate()->first();
            // Same parent -> record order as the explicit reassignment workflow.
            DB::table('jairoads_next.maintenance_records')->where('id', $record)->lockForUpdate()->first();
            $worker = new Process([PHP_BINARY, __DIR__.'/monthly-concurrency-request.php', (string) $f['user']->id,
                $method, '/dd-phase3/ops/updates'.($id === null ? '' : '/'.$id),
                json_encode(['maintenance_id' => $record, 'update_month' => '2026-01',
                    'progress_percentage' => 40, 'summary_of_text_reports' => 'Authorized revision'], JSON_THROW_ON_ERROR)]);
            $worker->setTimeout(20);
            $worker->start();
            $deadline = microtime(true) + 8;
            $waiting = null;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne("SELECT query FROM pg_stat_activity WHERE application_name = 'monthly_revocation_worker' AND wait_event_type = 'Lock'");
                if ($waiting !== null || ! $worker->isRunning()) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertNotNull($waiting, 'The request must actually block: '.$worker->getOutput().$worker->getErrorOutput());
            if ($change === 'deactivated') {
                DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
            } elseif ($change === 'unassigned') {
                DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $lgu)->update(['is_active' => false]);
            } elseif ($change === 'reassigned') {
                DB::table('jairoads_next.maintenance_records')->where('id', $record)->update(['managing_engineer_id' => $replacement]);
            }
            DB::commit();
            $worker->wait();
            $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
            $result = json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            $changed = $before !== DB::table('jairoads_next.monthly_updates')->orderBy('id')->get()->toJson();
            $auditChanged = $audit !== DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();
            $message = $method.' '.$change.'; report_changed='.($changed ? 'yes' : 'no').'; audit_changed='.($auditChanged ? 'yes' : 'no').'; blocked SQL: '.$waiting->query;
            $this->assertSame($change === 'unchanged' ? 302 : 403, $result['status'], $message);
            if ($change === 'unchanged') {
                $this->assertDatabaseHas('jairoads_next.monthly_updates', ['maintenance_id' => $record, 'progress_percentage' => 40]);
                $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MonthlyUpdate')->whereNull('recipient_user_id')->count());
            } else {
                $this->assertSame($before, DB::table('jairoads_next.monthly_updates')->orderBy('id')->get()->toJson(), $message);
                $this->assertSame($audit, DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson(), $message);
            }
            $this->assertStringContainsString('"maintenance_projects"', $waiting->query, $message.'; expected project serialization.');
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}
