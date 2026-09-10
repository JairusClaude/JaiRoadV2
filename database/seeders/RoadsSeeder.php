<?php

namespace Database\Seeders;

use App\Models\Road;
use Illuminate\Database\Seeder;

class RoadsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roads = [
            [
                'road_name' => 'RoadA-RoadB',
                'kilometers' => 2,
                'geojsondata' => 'andkwajndkafw...',
                'created_by' => 1,
                'lgu_id' => 1,
            ],
            [
                'road_name' => 'RoadC-RoadD',
                'kilometers' => 3,
                'geojsondata' => 'hrsfawafefwea...',
                'created_by' => 2,
                'lgu_id' => 2,
            ],
            [
                'road_name' => 'RoadE-RoadF',
                'kilometers' => 4,
                'geojsondata' => 'annwdaknwjnwda...',
                'created_by' => 3,
                'lgu_id' => 3,
            ],
            [
                'road_name' => 'RoadG-RoadH',
                'kilometers' => 4,
                'geojsondata' => 'nasjldnoawwdw...',
                'created_by' => 4,
                'lgu_id' => 4,
            ],
        ];
        foreach ($roads as $roadsData) {
            Road::create($roadsData);
        }
    }
}
