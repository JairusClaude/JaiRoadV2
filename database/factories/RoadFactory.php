<?php

namespace Database\Factories;

use App\Models\Lgu;
use App\Models\MaintenanceProject;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

class RoadFactory extends Factory
{
    protected $model = \App\Models\Road::class;

    public function definition(): array
    {
        $lon = $this->faker->longitude();
        $lat = $this->faker->latitude();

        // Generate a simple 2-point LineString (a short "road" segment)
        $lineString = [
            'type' => 'LineString',
            'coordinates' => [
                [$lon, $lat],
                [$lon + $this->faker->randomFloat(3, -0.05, 0.05), $lat + $this->faker->randomFloat(3, -0.05, 0.05)],
            ],
        ];

        return [
            'road_name'             => $this->faker->streetName(),
            'kilometers'            => $this->faker->randomFloat(2, 1, 50),
            'geojsondata'           => json_encode($lineString),
            'created_by'            => UserAccount::factory(),
            'lgu_id'                => Lgu::factory(),
            'maintenance_project_id' => MaintenanceProject::factory(),
        ];
    }

    /**
     * A road with a longer, multi-point LineString.
     */
    public function winding(int $points = 10): static
    {
        return $this->state(function () use ($points) {
            $lon = $this->faker->longitude();
            $lat = $this->faker->latitude();

            $coordinates = [];
            for ($i = 0; $i < $points; $i++) {
                $lon += $this->faker->randomFloat(4, -0.01, 0.01);
                $lat += $this->faker->randomFloat(4, -0.01, 0.01);
                $coordinates[] = [$lon, $lat];
            }

            return [
                'geojsondata' => json_encode([
                    'type'        => 'LineString',
                    'coordinates' => $coordinates,
                ]),
            ];
        });
    }
}   