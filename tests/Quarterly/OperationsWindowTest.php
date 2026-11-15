<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

final class OperationsWindowTest extends PostgresTestCase
{
    public function test_road_directory_discloses_extra_authorized_records_and_fetches_next_batch(): void
    {
        $fixture = $this->fixture('Admin');
        $lguId = (int) DB::table('jairoads_next.road_coverages')
            ->where('id', $fixture['road'])->value('lgu_id');
        $rows = [];
        for ($i = 1; $i <= 305; $i++) {
            $rows[] = [
                'road_name' => 'Batched road '.$i,
                'lgu_id' => $lguId,
                'kilometers' => 1,
                'pavement_type' => 'Concrete',
                'state_category' => 'Good',
                'created_by' => $fixture['engineer'],
                'geojson' => '{"type":"LineString","coordinates":[[125,7],[125.01,7.01]]}',
            ];
        }
        DB::table('jairoads_next.road_coverages')->insert($rows);

        $this->get('/dd-phase3/roads')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('dd-phase3/Operations')
            ->where('windowSize', 300)
            ->where('windowHasMore.roads', true)
            ->has('roads', 300));

        $this->get('/dd-phase3/roads?rows=600')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('dd-phase3/Operations')
            ->where('windowSize', 600)
            ->where('windowHasMore.roads', false)
            ->has('roads', 306));
    }

    public function test_large_window_is_bounded_and_does_not_grant_write_access(): void
    {
        $this->fixture('Viewer');
        $this->get('/dd-phase3/roads?rows=9999999')->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('dd-phase3/Operations')
                ->where('windowSize', 3000)
                ->where('capabilities.readOnly', true)
                ->where('windowHasMore.roads', false));
        $this->postJson('/dd-phase3/ops/roads', [])->assertForbidden();
    }
}
