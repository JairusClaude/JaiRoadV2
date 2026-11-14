<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

// Empty, explicitly guarded disposable PostgreSQL 17 database only.
require __DIR__.'/../../vendor/autoload.php';

final class AssignmentBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $engineer = $this->engineer();
        $engineerUser = $this->account('Engineer', $engineer);
        $road = $this->road($engineer);
        DB::table('jairoads_next.road_coverages')->where('id', $road)->update(['road_name' => 'Engineer available road']);
        DB::table('jairoads_next.engineers')->where('id', $engineer)->update(['first_name' => 'Engineer', 'last_name' => 'Creator']);
        $self = $this->engineer();
        $admin = $this->account('Admin', $self);
        $adminRoad = $this->road($self);
        DB::table('jairoads_next.road_coverages')->where('id', $adminRoad)->update(['road_name' => 'Admin available road']);
        DB::table('jairoads_next.engineers')->where('id', $self)->update(['first_name' => 'Admin', 'last_name' => 'Manager']);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $adminRoad)->value('lgu_id');
        $assigned = $this->engineer();
        $this->account('Engineer', $assigned);
        DB::table('jairoads_next.engineers')->where('id', $assigned)->update(['first_name' => 'Assigned', 'last_name' => 'Engineer']);
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $assigned, 'lgu_id' => $lgu, 'is_active' => true]);
        DB::commit();
        echo json_encode(['engineer_email' => $engineerUser->email, 'admin_email' => $admin->email,
            'engineer_id' => $engineer, 'admin_engineer_id' => $self, 'assigned_engineer_id' => $assigned], JSON_THROW_ON_ERROR);
    }
}

(new AssignmentBrowserFixture('prepare'))->prepare();
