<?php

namespace Database\Factories;

use App\Models\MaintenanceProject;
use App\Models\Engineer;
use App\Models\Lgu;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MaintenanceProject>
 */
class MaintenanceProjectFactory extends Factory
{
    protected $model = MaintenanceProject::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
         // 1. Generate chronological sequential dates safely
        $startDate = $this->faker->dateTimeBetween('-6 months', '+2 months');
        
        $end = clone $startDate;
        $end->modify('+1 month');

        $endDate = $this->faker->dateTimeBetween($startDate, $end);

        // 2. Define standard status strings for a project
        $statuses = ['Pending', 'Ongoing', 'Completed', 'Suspended'];

        return [
            // Combines words uniquely so project titles never collide in a single run
            'project_title'        => $this->faker->unique()->sentence(4),
            'description'          => $this->faker->paragraph(),
            
            // Randomly assigns a status; safe to duplicate because unique() is NOT called here
            'status'               => $this->faker->randomElement($statuses),
            
            'start_date'           => $startDate,
            'end_date'             => $endDate,
            
            // Generates a floating point number for road distance (e.g., 2.45 km)
            'gravelled_road_in_km' => $this->faker->randomFloat(4, 1.0, 4.0), 

            // 3. Connect to foreign relationship factories automatically
            'lgu_id'               => Lgu::factory(),
            'engineer_id'          => Engineer::factory(),
            'created_by'           => UserAccount::factory(),
        ];
    }
}
