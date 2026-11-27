<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\MonthlyUpdates\MonthlySubmissionReceipt;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

final class MonthlySubmissionReceiptTest extends PostgresTestCase
{
    private const TABLE = 'jairoads_next.monthly_submission_receipts';

    private const URL = '/workspace/ui/monthly-updates';

    private function applyProposal(string $name): void
    {
        $sql = file_get_contents(base_path('database/proposals/'.$name.'_REVIEW_ONLY.sql'));
        $this->assertIsString($sql);
        DB::unprepared(str_replace(["\nBEGIN;\n", "\nCOMMIT;\n"], "\n", $sql));
    }

    public function test_receipt_is_disabled_until_reviewed_and_replays_only_the_original_report(): void
    {
        $f = $this->fixture('Engineer');
        $account = (int) $f['user']->canonical_user_account_id;
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $account]
        );
        $payload = [
            'submission_id' => '104b840c-6914-4d85-8dd6-d677d41aa946',
            'reconnect_account_id' => $account, 'project_id' => $f['project'],
            'maintenance_id' => $record, 'update_month' => '2026-01',
            'progress_percentage' => '30', 'summary_of_text_reports' => 'Reviewed text report',
        ];
        $lookup = fn (array $overrides = []): string => self::URL.'/submission-outcome?'.http_build_query(array_replace([
            'submission_id' => $payload['submission_id'], 'account_id' => $account,
            'project_id' => $f['project'], 'maintenance_id' => $record, 'update_month' => '2026-01',
        ], $overrides));

        $this->postJson(self::URL, $payload)->assertServiceUnavailable();
        config(['jairoads_monthly_updates.durable_receipts_enabled' => true]);
        $this->postJson(self::URL, $payload)->assertServiceUnavailable();
        $this->applyProposal('monthly_submission_receipts');
        $this->getJson($lookup())->assertOk()->assertExactJson(['reportId' => null, 'receiptConfirmed' => false]);
        $this->postJson(self::URL, $payload)->assertRedirect();
        $id = (int) DB::table(self::TABLE)->value('report_id');
        $this->assertGreaterThan(0, $id);
        $this->postJson(self::URL, $payload)->assertRedirect(self::URL.'/'.$id);
        $this->getJson($lookup())->assertOk()->assertExactJson(['reportId' => $id, 'receiptConfirmed' => true])
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson(self::URL, array_replace($payload, ['summary_of_text_reports' => 'Different text']))->assertConflict();
        $this->postJson(self::URL, array_replace($payload, ['update_month' => '2026-02']))->assertConflict();
        $this->postJson(self::URL, array_replace($payload, ['submission_id' => 'c430df14-0892-45e2-a1f4-d7b71d9bde81']))->assertUnprocessable();
        $this->getJson($lookup(['update_month' => '2026-02']))->assertConflict();
        $this->getJson($lookup(['account_id' => $account + 100]))->assertForbidden();
        $this->assertSame(1, DB::table(self::TABLE)->count());
        $this->assertSame(1, DB::table('jairoads_next.monthly_updates')->count());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MonthlyUpdate')->whereNull('recipient_user_id')->count());
        $this->assertDatabaseHas('jairoads_next.monthly_updates', ['id' => $id, 'summary_of_text_reports' => 'Reviewed text report']);

        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'));
        $this->getJson($lookup())->assertForbidden();
        $this->postJson(self::URL, $payload)->assertForbidden();
    }

    public function test_receipt_failure_rolls_back_the_report_and_audit(): void
    {
        $f = $this->fixture('Engineer');
        $account = (int) $f['user']->canonical_user_account_id;
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $account]
        );
        $this->applyProposal('monthly_submission_receipts');
        config(['jairoads_monthly_updates.durable_receipts_enabled' => true]);
        DB::unprepared("CREATE FUNCTION pg_temp.reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic receipt failure'; END; $$");
        DB::unprepared('CREATE TRIGGER reject_receipt BEFORE INSERT ON '.self::TABLE.' FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_receipt()');
        $this->postJson(self::URL, [
            'submission_id' => '104b840c-6914-4d85-8dd6-d677d41aa946',
            'reconnect_account_id' => $account, 'project_id' => $f['project'],
            'maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => '10',
        ])->assertStatus(500);
        $this->assertSame(0, DB::table(self::TABLE)->count());
        $this->assertSame(0, DB::table('jairoads_next.monthly_updates')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MonthlyUpdate')->whereNull('recipient_user_id')->count());
    }

    public function test_two_waiting_requests_with_the_same_uuid_commit_one_report_and_one_receipt(): void
    {
        $f = $this->fixture('Engineer');
        $account = (int) $f['user']->canonical_user_account_id;
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $account]
        );
        $this->applyProposal('monthly_submission_receipts');
        $payload = [
            'submission_id' => '104b840c-6914-4d85-8dd6-d677d41aa946',
            'reconnect_account_id' => $account, 'project_id' => $f['project'],
            'maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => '20',
        ];
        DB::commit(); // Positively guarded disposable fixture for independent connections.
        $workers = [];
        try {
            DB::beginTransaction();
            MonthlySubmissionReceipt::lock($account, $payload['submission_id']);
            for ($i = 0; $i < 2; $i++) {
                $worker = new Process([PHP_BINARY, __DIR__.'/monthly-concurrency-request.php', (string) $f['user']->id,
                    'POST', '/workspace/ops/updates', json_encode($payload, JSON_THROW_ON_ERROR)],
                    env: ['JAIROADS_MONTHLY_RECEIPTS_ENABLED' => 'true']);
                $worker->setTimeout(20);
                $workers[] = $worker;
                $worker->start();
            }
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'monthly_revocation_worker' AND wait_event_type = 'Lock' AND query LIKE '%pg_advisory_xact_lock%'")->n;
                if ($waiting === 2) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertSame(2, $waiting, 'Both requests must wait on the actual receipt lock.');
            DB::commit();
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
                $this->assertSame(302, json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR)['status']);
            }
            $this->assertSame(1, DB::table(self::TABLE)->count());
            $this->assertSame(1, DB::table('jairoads_next.monthly_updates')->count());
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MonthlyUpdate')->whereNull('recipient_user_id')->count());
        } finally {
            foreach ($workers as $worker) {
                $worker->stop();
            }
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::unprepared('DROP TABLE IF EXISTS '.self::TABLE);
            PostgresTestSchema::clearCommittedFixtures();
        }
    }

    public function test_reviewed_runtime_grants_allow_insert_and_read_but_not_mutation(): void
    {
        DB::statement('CREATE ROLE jairoads_app_runtime NOLOGIN');
        DB::statement('GRANT USAGE ON SCHEMA jairoads_next TO jairoads_app_runtime');
        $this->applyProposal('monthly_submission_receipts');
        $this->applyProposal('monthly_submission_receipt_runtime_grants');
        DB::statement('SET LOCAL ROLE jairoads_app_runtime');
        try {
            $this->assertTrue(DB::selectOne("select row_security_active('jairoads_next.monthly_submission_receipts') as active")->active);
            DB::table(self::TABLE)->insert([
                'account_id' => 1, 'submission_id' => '104b840c-6914-4d85-8dd6-d677d41aa946',
                'project_id' => 1, 'maintenance_id' => 1, 'reporting_month' => '2026-01',
                'fingerprint' => str_repeat('a', 64), 'report_id' => 1,
            ]);
            $this->assertSame(1, DB::table(self::TABLE)->count());
            foreach (['UPDATE '.self::TABLE.' SET report_id = 2', 'DELETE FROM '.self::TABLE] as $statement) {
                try {
                    DB::transaction(fn () => DB::statement($statement));
                    $this->fail('Retained receipts must not be mutable by runtime.');
                } catch (QueryException $e) {
                    $this->assertSame('42501', $e->errorInfo[0]);
                }
            }
        } finally {
            DB::statement('RESET ROLE');
        }
    }
}
