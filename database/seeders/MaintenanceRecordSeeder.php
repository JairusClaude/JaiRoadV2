<?php

namespace Database\Seeders;

use App\Models\MaintenanceRecord;
use Illuminate\Database\Seeder;

class MaintenanceRecordSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $maintenanceRecord = [
            [
                'maintenance_projects_id' => 1,
                'engineers_id' => 1,
                'maintenance_year' => 2025,
                'quarter' => 'Q1',
                'start_date' => '2025-01-01',
                'estimated_duration_days' => 30,
                'complete_date' => '2025-01-31',
                'status' => 'Completed',
                'description' => 'First quarter road maintenance.',
                'created_by' => 1,
            ],
            [
                'maintenance_projects_id' => 2,
                'engineers_id' => 2,
                'maintenance_year' => 2025,
                'quarter' => 'Q2',
                'start_date' => '2025-04-01',
                'estimated_duration_days' => 60,
                'complete_date' => '2025-05-31',
                'status' => 'Completed',
                'description' => 'Second quarter road maintenance.',
                'created_by' => 2,
            ],
            [
                'maintenance_projects_id' => 3,
                'engineers_id' => 3,
                'maintenance_year' => 2025,
                'quarter' => 'Q3',
                'start_date' => '2025-07-01',
                'estimated_duration_days' => 90,
                'complete_date' => null,
                'status' => 'Ongoing',
                'description' => 'Third quarter road maintenance.',
                'created_by' => 3,
            ],
            [
                'maintenance_projects_id' => 4,
                'engineers_id' => 4,
                'maintenance_year' => 2025,
                'quarter' => 'Q4',
                'start_date' => '2025-10-01',
                'estimated_duration_days' => 45,
                'complete_date' => null,
                'status' => 'Suspended',
                'description' => 'Fourth quarter road maintenance.',
                'created_by' => 4,
            ],
        ];

        foreach ($maintenanceRecord as $maintenanceRecordData) {
            MaintenanceRecord::create($maintenanceRecordData);
        }
    }
}
