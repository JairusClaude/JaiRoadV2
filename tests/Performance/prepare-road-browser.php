<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

$benchmark = new class('prepare') extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $f = $this->fixture('Engineer');
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $count = (int) getenv('BENCH_ROADS');
        if (! in_array($count, [1, 100, 500, 1000], true)) {
            throw new RuntimeException('Choose a documented disposable fixture size.');
        }
        for ($i = 2; $i <= $count; $i++) {
            $points = [];
            for ($v = 0; $v < 150; $v++) {
                $points[] = [($i % 2 ? 125.95 : 126.7) + $v * 0.00001, ($i % 2 ? 7.59 : 8.2) + $v * 0.00001];
            }
            DB::table('jairoads_next.road_coverages')->insert(['road_name' => sprintf('Synthetic %04d', $i), 'lgu_id' => $lgu,
                'kilometers' => 1, 'pavement_type' => 'Concrete', 'state_category' => 'Good', 'created_by' => $f['engineer'], 'geojson' => json_encode(['type' => 'LineString', 'coordinates' => $points])]);
        }
        DB::commit();
        echo json_encode(['engineer_email' => $f['user']->email, 'count' => $count], JSON_THROW_ON_ERROR);
    }
};
$benchmark->prepare();
