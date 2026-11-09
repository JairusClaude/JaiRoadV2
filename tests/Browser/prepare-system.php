<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

/** Guarded empty disposable PostgreSQL only; fake object metadata has no real Storage counterpart. */
final class SystemBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        // Final DD: project and ManagingEngineer references must remain required.
        (require base_path('database/proposals/create_file_deletions.php'))->up(); // Disposable schema-owner rehearsal only.
        $f = $this->fixture('Engineer');
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.lgus')->where('id', $lgu)->update(['municipality_name' => 'Compostela']);
        DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['road_name' => 'Seeded three point road', 'geojson' => '{"type":"LineString","coordinates":[[125.95,7.59],[125.96,7.60],[125.97,7.61]]}']);
        $admin = $this->account();
        $super = $this->account('SuperAdmin');
        $viewer = $this->account('Viewer');
        $rogue = $this->engineer();
        $rogueLogin = $this->account('Engineer', $rogue);
        $this->road($rogue);
        $record = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $document = DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $record, 'document_title' => 'Seeded private document', 'file_name' => 'seed.pdf', 'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-000000000001.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $monthly = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
        $media = DB::table('jairoads_next.media')->insertGetId(['monthly_update_id' => $monthly, 'file_name' => 'seed.png', 'file_type' => 'image/png', 'file_path' => 'monthly-updates/'.$monthly.'/00000000-0000-4000-8000-000000000001.png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $preservedProject = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId(['road_coverage_id' => $this->road($f['engineer']), 'project_title' => 'Preserved Docker history', 'created_by' => $admin->dd_user_account_id]);
        $preservedRecord = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($preservedProject, $f['engineer'], 'Q2') + ['created_by' => $admin->dd_user_account_id]);
        $preservedUpdate = (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $preservedRecord, 'update_month' => '2026-04', 'progress_percentage' => 25, 'created_by' => $admin->dd_user_account_id]);
        $preservedDocument = (int) DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $preservedRecord, 'document_title' => 'Retained Docker document', 'file_name' => 'seed.pdf', 'file_path' => 'maintenance-records/'.$preservedRecord.'/00000000-0000-4000-8000-000000000001.pdf', 'uploaded_by' => $admin->dd_user_account_id]);
        $preservedMedia = (int) DB::table('jairoads_next.media')->insertGetId(['monthly_update_id' => $preservedUpdate, 'file_name' => 'seed.png', 'file_type' => 'image/png', 'file_path' => 'monthly-updates/'.$preservedUpdate.'/00000000-0000-4000-8000-000000000001.png', 'uploaded_by' => $admin->dd_user_account_id]);
        // Strict-DD browser fixture: a distinct RoadCoverage and an EMPTY project.
        // Existing fixture projects retain their records and private attachments.
        $emptyRoadId = $this->road($f['engineer']);
        $emptyProject = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId([
            'road_coverage_id' => $emptyRoadId,
            'project_title' => 'Phase 11L empty project',
            'created_by' => $admin->dd_user_account_id,
        ]);
        DB::commit();
        echo json_encode(['admin_email' => $admin->email, 'superadmin_email' => $super->email,
            'engineer_email' => $f['user']->email, 'viewer_email' => $viewer->email, 'rogue_email' => $rogueLogin->email,
            'engineer_id' => $f['engineer'], 'viewer_id' => $viewer->dd_user_account_id,
            'lgu_id' => (int) $lgu, 'project_id' => $f['project'], 'empty_project' => $emptyProject, 'record_id' => (int) $record,
            'preserved_project' => $preservedProject, 'preserved_record' => $preservedRecord, 'preserved_document' => $preservedDocument, 'preserved_media' => $preservedMedia,
            'document_id' => (int) $document, 'media_id' => (int) $media], JSON_THROW_ON_ERROR);
    }
}

(new SystemBrowserFixture('prepare'))->prepare();
