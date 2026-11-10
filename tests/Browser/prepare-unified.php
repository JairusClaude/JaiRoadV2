<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

/** Guarded empty disposable PostgreSQL only; fake object metadata has no real Storage counterpart. */
final class UnifiedFrontendBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        DB::unprepared(file_get_contents(base_path('database/proposals/security_monitoring.sql')));
        // Final DD: project and ManagingEngineer references must remain required.
        (require base_path('database/proposals/create_file_deletions.php'))->up(); // Guarded disposable rehearsal, never shared.
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
        // Enough authorized reporting months to exercise real responsive pagination.
        for ($month = 1; $month <= 13; $month++) {
            DB::table('jairoads_next.monthly_updates')->insert([
                'maintenance_id' => $record, 'update_month' => $month <= 12 ? sprintf('2025-%02d', $month) : '2026-02',
                'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id,
            ]);
        }
        $media = DB::table('jairoads_next.media')->insertGetId(['monthly_update_id' => $monthly, 'file_name' => 'seed.png', 'file_type' => 'image/png', 'file_path' => 'monthly-updates/'.$monthly.'/00000000-0000-4000-8000-000000000001.png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $destination = DB::table('jairoads_next.lgus')->insertGetId(['municipality_name' => 'Destination town', 'province' => 'Test', 'region' => 'Test', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor']);
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $f['engineer'], 'lgu_id' => $destination, 'is_active' => true]);
        $line = ['type' => 'LineString', 'coordinates' => [[125.95, 7.59], [125.96, 7.60], [125.97, 7.61]]];
        $geometryRoads = [];
        foreach ([
            'mapped' => ['type' => 'Feature', 'properties' => ['jairoads_mapping' => ['version' => 1, 'method' => 'manual', 'control_points' => [$line['coordinates'][0], $line['coordinates'][2]], 'control_point_indices' => [0, 2]]], 'geometry' => $line],
            'legacy' => $line,
            'feature' => ['type' => 'Feature', 'properties' => ['historical' => true], 'geometry' => $line],
            'multi' => ['type' => 'MultiLineString', 'coordinates' => [$line['coordinates'], [[126, 8], [126.1, 8.1]]]],
            'collection' => ['type' => 'GeometryCollection', 'geometries' => [$line, $line]],
            'features' => ['type' => 'FeatureCollection', 'features' => [['type' => 'Feature', 'properties' => [], 'geometry' => $line]]],
            'dimensions' => ['type' => 'LineString', 'coordinates' => [[125, 7, 12, 99], [125.1, 7.1, 13, 98]]],
            'invalid' => ['type' => 'Point', 'coordinates' => [125, 7]],
        ] as $format => $geometry) {
            $geometryRoads[] = ['format' => $format, 'id' => (int) DB::table('jairoads_next.road_coverages')->insertGetId([
                'road_name' => 'Saved geometry '.$format, 'lgu_id' => $lgu, 'kilometers' => '2.50',
                'pavement_type' => 'Concrete', 'state_category' => 'Good', 'created_by' => $f['engineer'],
                'geojson' => json_encode($geometry, JSON_THROW_ON_ERROR),
            ])];
        }
        $auditHistory = [];
        for ($i = 0; $i < 26; $i++) {
            $auditHistory[] = (int) DB::table('jairoads_next.audit_logs')->insertGetId(['user_id' => $super->dd_user_account_id,
                'actor_identifier' => 'Historical browser fixture', 'action' => 'LOGIN', 'entity_type' => 'UserAccount',
                'entity_id' => $super->dd_user_account_id, 'description' => 'Retained historical authentication entry', 'created_at' => '2020-01-01 00:00:00']);
        }
        // Strict-DD browser fixture: a distinct RoadCoverage and an EMPTY project.
        // Existing fixture projects retain their records and private attachments.
        $emptyRoadId = $this->road($f['engineer']);
        $emptyProject = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId([
            'road_coverage_id' => $emptyRoadId,
            'project_title' => 'Phase 11L empty project',
            'created_by' => $admin->dd_user_account_id,
        ]);
        DB::commit();
        echo json_encode(['audit_history_ids' => $auditHistory, 'session_cookie_name' => config('session.cookie'), 'admin_email' => $admin->email, 'superadmin_email' => $super->email,
            'engineer_email' => $f['user']->email, 'viewer_email' => $viewer->email, 'rogue_email' => $rogueLogin->email,
            'geometry_roads' => $geometryRoads, 'road_id' => $f['road'], 'destination_id' => (int) $destination, 'engineer_id' => $f['engineer'], 'viewer_id' => $viewer->dd_user_account_id,
            'lgu_id' => (int) $lgu, 'project_id' => $f['project'], 'empty_project' => $emptyProject, 'record_id' => (int) $record,
            'document_id' => (int) $document, 'media_id' => (int) $media], JSON_THROW_ON_ERROR);
    }
}

(new UnifiedFrontendBrowserFixture('prepare'))->prepare();
