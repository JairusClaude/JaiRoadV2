<?php

namespace Database\Factories;

use App\Models\Engineer;
use App\Models\Lgu;
use App\Models\MaintenanceProject;
use App\Models\UserAccount;
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
            'lgus_id' => Lgu::factory(),
            'engineers_id' => Engineer::factory(),
            'created_by' => UserAccount::factory(),
        ];
    }
}
