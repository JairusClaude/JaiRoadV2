<?php

namespace Database\Factories;

use App\Models\Engineer;
use App\Models\MaintenanceProject;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MaintenanceProject>
 */
class MaintenanceProjectFactory extends Factory
{
    protected $model = MaintenanceProject::class;

    public function definition(): array
    {
        $startDate = fake()->dateTimeBetween('-6 months', 'now');

        $endDate = (clone $startDate)->modify(
            '+'.fake()->numberBetween(1, 180).' days'
        );

        return [
            'project_title' => fake()->unique()->sentence(4),
            'description' => fake()->paragraph(),
            'status' => fake()->randomElement([
                'Pending',
                'Ongoing',
                'Completed',
                'Suspended',
            ]),
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate->format('Y-m-d'),
            'gravelled_road_in_km' => fake()->numberBetween(1, 50),
            'engineers_id' => Engineer::factory(),
            'lgus_id' => fn (array $attributes): int => (int) Engineer::query()
                ->whereKey((int) $attributes['engineers_id'])
                ->firstOrFail()
                ->getAttribute('lgus_id'),
        ];
    }
}
