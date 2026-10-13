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

    public function definition(): array
    {
        return [
            'update_month' => fake()
                ->dateTimeBetween('-12 months', 'now')
                ->format('Y-m'),

            'progress_percentage' => fake()->numberBetween(0, 100),
            'summary_of_text_reports' => fake()->paragraph(),
            'maintenance_projects_id' => MaintenanceProject::factory(),
            'created_by' => UserAccount::factory(),
        ];
    }
}
