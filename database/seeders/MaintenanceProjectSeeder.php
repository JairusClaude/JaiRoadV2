<?php

namespace Database\Seeders;

use App\Models\MaintenanceProject;
use Illuminate\Database\Seeder;

class MaintenanceProjectSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $maintenanceProject = [
            [
                'project_title' => 'Project_Maintainance_1',
                'description' => 'Road Maintenance',
                'status' => 'Ongoing',
                'start_date' => '2025-01-01',
                'end_date' => '2025-02-01',
                'gravelled_road_in_km' => 4,
                'lgu_id' => 1,
                'engineer_id' => 1,
                'created_by' => 1,
            ],
            [
                'project_title' => 'Project_Maintainance_2',
                'description' => 'Road Maintenance',
                'status' => 'Ongoing',
                'start_date' => '2025-02-01',
                'end_date' => '2025-03-01',
                'gravelled_road_in_km' => 3,
                'lgu_id' => 2,
                'engineer_id' => 2,
                'created_by' => 2,
            ],
            [
                'project_title' => 'Project_Maintainance_3',
                'description' => 'Road Maintenance',
                'status' => 'Ongoing',
                'start_date' => '2025-03-01',
                'end_date' => '2025-04-01',
                'gravelled_road_in_km' => 5,
                'lgu_id' => 3,
                'engineer_id' => 3,
                'created_by' => 3,
            ],
            [
                'project_title' => 'Project_Maintainance_4',
                'description' => 'Road Maintenance',
                'status' => 'Ongoing',
                'start_date' => '2025-04-01',
                'end_date' => '2025-05-01',
                'gravelled_road_in_km' => 6,
                'lgu_id' => 4,
                'engineer_id' => 4,
                'created_by' => 4,
            ],
        ];

        foreach ($maintenanceProject as $maintenanceProjectData) {
            MaintenanceProject::create($maintenanceProjectData);
        }
    }
}