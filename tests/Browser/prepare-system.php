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
        DB::commit();
        echo json_encode(['admin_email' => $admin->email, 'superadmin_email' => $super->email,
            'engineer_email' => $f['user']->email, 'viewer_email' => $viewer->email, 'rogue_email' => $rogueLogin->email,
            'engineer_id' => $f['engineer'], 'viewer_id' => $viewer->dd_user_account_id,
            'lgu_id' => (int) $lgu, 'project_id' => $f['project'], 'record_id' => (int) $record,
            'document_id' => (int) $document, 'media_id' => (int) $media], JSON_THROW_ON_ERROR);
    }
}

(new SystemBrowserFixture('prepare'))->prepare();
