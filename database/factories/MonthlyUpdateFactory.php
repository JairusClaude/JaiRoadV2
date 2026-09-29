<?php

namespace Database\Factories;

use App\Models\MaintenanceProject;
use App\Models\MonthlyUpdate;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MonthlyUpdate>
 */
class MonthlyUpdateFactory extends Factory
{
    protected $model = MonthlyUpdate::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startDate = $this->faker->dateTimeBetween('-6 months', 'now');
        return [
            'update_month' => $startDate->format('Y-m-01 00:00:00'),
            'progress_percentage' => $this->faker->numberBetween(0, 100),
            'summary_of_text_reports' => $this->faker->paragraph(),

            'maintenance_project_id' => MaintenanceProject::factory(),
            'created_by' => UserAccount::factory(),
        ];
    }
}
