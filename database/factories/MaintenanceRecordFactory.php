<?php

namespace Database\Factories;

use App\Models\Engineer;
use App\Models\MaintenanceProject;
use App\Models\MaintenanceRecord;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MaintenanceRecord>
 */
class MaintenanceRecordFactory extends Factory
{
    protected $model = MaintenanceRecord::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $status = fake()->randomElement([
            'Pending',
            'Ongoing',
            'Completed',
            'Suspended',
        ]);

        $startDate = $status === 'Pending'
            ? fake()->dateTimeBetween('now', '+6 months')
            : fake()->dateTimeBetween('-2 years', '-6 months');

        $duration = fake()->numberBetween(7, 120);

        $completeDate = $status === 'Completed'
            ? (clone $startDate)
                ->modify("+{$duration} days")
                ->format('Y-m-d')
            : null;

        $month = (int) $startDate->format('n');

        return [
            'maintenance_projects_id' => MaintenanceProject::factory(),
            'engineers_id' => Engineer::factory(),
            'maintenance_year' => (int) $startDate->format('Y'),
            'quarter' => 'Q'.(string) ceil($month / 3),
            'start_date' => $startDate->format('Y-m-d'),
            'estimated_duration_days' => $duration,
            'complete_date' => $completeDate,
            'status' => $status,
            'description' => fake()->paragraph(),
            'created_by' => UserAccount::factory(),
        ];
    }
}
