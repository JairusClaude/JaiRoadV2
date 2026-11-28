<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

final class AndroidFieldWritesTest extends PostgresTestCase
{
    private const URL = '/workspace/ui/android-field';

    public function test_field_operations_commit_with_receipts_and_reject_stale_edits(): void
    {
        $fixture = $this->fixture('Engineer');
        $account = (int) $fixture['user']->canonical_user_account_id;
        $this->getJson(self::URL.'/workspace')->assertNotFound();
        config(['jairoads_monthly_updates.android_field_enabled' => true]);
        $this->getJson(self::URL.'/workspace')->assertOk()->assertJsonPath('canSync', false);

        DB::unprepared(<<<'SQL'
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jairoads_app_runtime') THEN
                    CREATE ROLE jairoads_app_runtime;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
                    CREATE ROLE anon;
                END IF;
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
                    CREATE ROLE authenticated;
                END IF;
            END $$;
            SQL);
        $sql = file_get_contents(base_path('database/proposals/android_field_receipts.sql'));
        $this->assertIsString($sql);
        DB::unprepared(str_replace(["BEGIN;\n", "COMMIT;\n"], '', $sql));

        $operation = [
            'account_id' => $account,
            'operation_id' => '104b840c-6914-4d85-8dd6-d677d41aa946',
            'kind' => 'road',
            'fields' => [
                'road_name' => 'Offline fixture road',
                'lgu_id' => (int) DB::table('jairoads_next.road_coverages')->where('id', $fixture['road'])->value('lgu_id'),
                'kilometers' => '1.50',
                'pavement_type' => 'Concrete',
                'state_category' => 'Good',
                'geojson' => '{"type":"LineString","coordinates":[[123,10],[123.01,10.01]]}',
            ],
        ];
        $saved = $this->postJson(self::URL.'/operations', $operation)->assertOk()->json();
        $this->postJson(self::URL.'/operations', $operation)->assertOk()->assertExactJson($saved);
        $this->postJson(self::URL.'/operations', array_replace($operation, [
            'fields' => array_replace($operation['fields'], ['kilometers' => '2.50']),
        ]))->assertConflict();
        $this->assertSame(1, DB::table('jairoads_next.road_coverages')->where('road_name', 'Offline fixture road')->count());

        $project = [
            'account_id' => $account,
            'operation_id' => 'b1bbdeb4-4797-4d13-8d8b-7af44340da32',
            'kind' => 'project',
            'fields' => ['project_title' => 'Offline fixture project', 'road_coverage_id' => $saved['id'], 'description' => 'Fieldwork'],
        ];
        $savedProject = $this->postJson(self::URL.'/operations', $project)->assertOk()->json();
        $record = $this->postJson(self::URL.'/operations', [
            'account_id' => $account,
            'operation_id' => '45ecdd55-caaf-4fb0-a9f9-479eff532f26',
            'kind' => 'record',
            'fields' => [
                'project_id' => $savedProject['id'], 'maintenance_year' => 2026, 'quarter' => 'Q1',
                'start_date' => '2026-01-01', 'estimated_duration_days' => 5, 'status' => 'Ongoing',
            ],
        ])->assertOk()->json();
        $this->getJson(self::URL.'/workspace')->assertOk()->assertJsonPath('canSync', true)
            ->assertJsonPath('records.0.project_id', $savedProject['id']);
        $this->postJson(self::URL.'/operations', array_replace($project, [
            'operation_id' => 'bf176a01-defc-4931-bc4c-ce9ed79b29b0', 'id' => $savedProject['id'], 'version' => 'stale',
        ]))->assertConflict();
        $this->postJson(self::URL.'/operations', array_replace($project, ['account_id' => $account + 100]))->assertForbidden();
        $this->assertSame(3, DB::table('jairoads_security.android_field_receipts')->count());
        $month = ['account_id' => $account, 'operation_id' => '2b819d89-729d-446d-9d51-2fe74a29a001', 'kind' => 'monthly',
            'fields' => ['maintenance_id' => $record['id'], 'update_month' => '2026-02', 'progress_percentage' => '25', 'summary_of_text_reports' => 'Initial field report']];
        $report = $this->postJson(self::URL.'/operations', $month)->assertOk()->json();
        $edit = array_replace($month, ['operation_id' => '2b819d89-729d-446d-9d51-2fe74a29a002', 'id' => $report['id'], 'version' => $report['version'],
            'fields' => array_replace($month['fields'], ['progress_percentage' => '40'])]);
        $edited = $this->postJson(self::URL.'/operations', $edit)->assertOk()->json();
        $this->postJson(self::URL.'/operations', $edit)->assertOk()->assertExactJson($edited);
        $this->assertSame((float) 40, (float) DB::table('jairoads_next.monthly_updates')->where('id', $report['id'])->value('progress_percentage'));
        $this->postJson(self::URL.'/operations', array_replace($edit, ['operation_id' => '2b819d89-729d-446d-9d51-2fe74a29a003', 'version' => 'stale']))->assertConflict();
        $this->getJson(self::URL.'/workspace')->assertOk()->assertJsonStructure(['municipalities' => [['id', 'municipality_name', 'province', 'region']], 'lguAssignments', 'monthly' => [['id', 'version']]]);

        config(['jairoads_documents.supabase_url' => 'https://disposable-storage.test',
            'jairoads_documents.service_role_key' => 'sb_secret_disposable', 'jairoads_documents.bucket' => 'private-documents',
            'jairoads_file_deletion.upload_journal_enabled' => false]);
        Http::fake(['*/storage/v1/object/*' => Http::response([], 200)]);
        $attachment = ['account_id' => $account, 'operation_id' => '611c973d-6d78-4433-a3e5-6705ad7248d3',
            'kind' => 'document', 'parent_id' => $record['id'], 'document_title' => 'Field inspection', 'description' => 'Saved offline'];
        $pdf = static fn () => UploadedFile::fake()->createWithContent('inspection.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
        $first = $this->post(self::URL.'/attachments', $attachment + ['file' => $pdf()], ['Accept' => 'application/json'])->assertOk()->json();
        $this->post(self::URL.'/attachments', $attachment + ['file' => $pdf()], ['Accept' => 'application/json'])->assertOk()->assertExactJson($first);
        $this->post(self::URL.'/attachments', array_replace($attachment, ['document_title' => 'Changed']) + ['file' => $pdf()], ['Accept' => 'application/json'])->assertConflict();
        $this->assertSame(1, DB::table('jairoads_next.maintenance_documents')->where('maintenance_id', $record['id'])->count());
        Http::assertSentCount(1);
        $this->getJson(self::URL.'/workspace')->assertOk()->assertJsonPath('fileSync', true)->assertJsonPath('files.0.id', $first['id']);
        $large = UploadedFile::fake()->createWithContent('inspection-large.pdf', "%PDF-1.4\n".str_repeat('% field evidence padding '.str_repeat('x', 100)."\n", 45000).'%%EOF');
        $this->post(self::URL.'/attachments', array_replace($attachment, ['operation_id' => '611c973d-6d78-4433-a3e5-6705ad7248d4']) + ['file' => $large], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame(2, DB::table('jairoads_next.maintenance_documents')->where('maintenance_id', $record['id'])->count());
    }
}
