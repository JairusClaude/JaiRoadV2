<?php

namespace Database\Factories;

use App\Models\Lgu;
use App\Models\Road;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Road>
 */
class RoadFactory extends Factory
{
    protected $model = Road::class;

    public function definition(): array
    {
        // Approximate coordinates around the Davao Region.
        $longitude = fake()->randomFloat(6, 125.0, 126.5);
        $latitude = fake()->randomFloat(6, 6.8, 8.2);

        $geoJson = [
            'type' => 'LineString',
            'coordinates' => [
                [$longitude, $latitude],
                [
                    $longitude + fake()->randomFloat(6, -0.005, 0.005),
                    $latitude + fake()->randomFloat(6, -0.005, 0.005),
                ],
            ],
        ];

        return [
            'road_name' => fake()->streetName(),
            'kilometers' => fake()->numberBetween(1, 50),
            'geojsondata' => json_encode(
                $geoJson,
                JSON_UNESCAPED_SLASHES
            ),
            'created_by' => UserAccount::factory(),
            'lgus_id' => Lgu::factory(),
            'road_id' => null,
        ];
    }

    /**
     * Create a road that has a parent road.
     */
    public function child(): static
    {
        return $this->state(fn (array $attributes) => [
            'road_id' => Road::factory(),
        ]);
    }
}
