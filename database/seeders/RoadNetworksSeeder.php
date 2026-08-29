<?php

namespace Database\Seeders;

use App\Models\RoadNetwork;
use Illuminate\Database\Seeder;

class RoadNetworksSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roadNetworks = [
            [
                'road_id' => 1,
                'project_id' => 1,
            ],
            [
                'road_id' => 2,
                'project_id' => 2,
            ],
            [
                'road_id' => 3,
                'project_id' => 3,
            ],
            [
                'road_id' => 4,
                'project_id' => 4,
            ],
        ];
        foreach ($roadNetworks as $roadNetworksData) {
            RoadNetwork::create($roadNetworksData);
        }
    }
}
