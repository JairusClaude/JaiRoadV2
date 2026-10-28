<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

/** Empty, explicitly guarded disposable PostgreSQL 17 only. Never calls Storage. */
final class MunicipalityBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $f = $this->fixture('Engineer');
        $admin = $this->account();
        $viewer = $this->account('Viewer');
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.lgus')->where('id', $lgu)->update(['municipality_name' => 'Nabunturan']);
        DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['road_name' => 'Municipality acceptance road',
            'geojson' => '{"type":"LineString","coordinates":[[125.95,7.59],[125.96,7.60],[125.97,7.61]]}']);
        $destination = (int) DB::table('jairoads_next.lgus')->insertGetId(['municipality_name' => 'Mawab', 'province' => 'Test province', 'region' => 'Test region', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor']);
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $f['engineer'], 'lgu_id' => $destination, 'is_active' => true]);
        $record = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.maintenance_documents')->insert(['maintenance_id' => $record, 'document_title' => 'Private fixture document', 'file_name' => 'fixture.pdf', 'file_path' => 'private/fixture.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.media')->insert(['monthly_update_id' => $update, 'file_name' => 'fixture.png', 'file_path' => 'private/fixture.png', 'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        DB::commit();
        echo json_encode(['admin_email' => $admin->email, 'engineer_email' => $f['user']->email, 'viewer_email' => $viewer->email,
            'road_id' => $f['road'], 'project_id' => $f['project'], 'record_id' => (int) $record, 'engineer_id' => $f['engineer'],
            'source_lgu_id' => (int) $lgu, 'destination_lgu_id' => $destination], JSON_THROW_ON_ERROR);
    }
}

(new MunicipalityBrowserFixture('prepare'))->prepare();
