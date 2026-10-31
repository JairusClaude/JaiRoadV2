<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

/** No cloud connections: guarded empty disposable PostgreSQL fixture only. */
final class LifecycleBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $f = $this->fixture('Engineer');
        DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['first_name' => 'Former', 'last_name' => 'Manager', 'contact_no' => '09123456789']);
        $replacement = $this->engineer();
        DB::table('jairoads_next.engineers')->where('id', $replacement)->update(['first_name' => 'Replacement', 'last_name' => 'Manager']);
        $next = $this->account('Engineer', $replacement);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => true]);
        $admin = $this->account();
        $viewer = $this->account('Viewer');
        $record = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.maintenance_documents')->insert(['maintenance_id' => $record, 'document_title' => 'Browser fixture', 'file_name' => 'fixture.pdf', 'file_path' => 'private/nonexistent-fixture.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.media')->insert(['monthly_update_id' => $update, 'file_name' => 'fixture.png', 'file_type' => 'image/png', 'file_path' => 'private/nonexistent-fixture.png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        DB::commit();
        echo json_encode(['admin_email' => $admin->email, 'viewer_email' => $viewer->email, 'viewer_id' => $viewer->dd_user_account_id,
            'former_email' => $f['user']->email, 'former_id' => $f['engineer'], 'replacement_email' => $next->email,
            'replacement_id' => $replacement, 'project_id' => $f['project']], JSON_THROW_ON_ERROR);
    }
}

(new LifecycleBrowserFixture('prepare'))->prepare();
