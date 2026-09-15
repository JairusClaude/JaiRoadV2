<?php

namespace Database\Seeders;

use App\Models\MonthlyUpdate;
use Illuminate\Database\Seeder;

class MonthlyUpdatesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $monthlyUpdates = [
            [
                'maintenance_project_id' => 1,
                'update_month' => 'Febuary',
                'progress_percentage' => 90,
                'summary_of_text_reports' => 'Summary...',
                'created_by' => 1,
            ],
            [
                'maintenance_project_id' => 2,
                'update_month' => 'March',
                'progress_percentage' => 80,
                'summary_of_text_reports' => 'Summary...',
                'created_by' => 2,
            ],
            [
                'maintenance_project_id' => 3,
                'update_month' => 'April',
                'progress_percentage' => 70,
                'summary_of_text_reports' => 'Summary...',
                'created_by' => 3,
            ],
            [
                'maintenance_project_id' => 4,
                'update_month' => 'May',
                'progress_percentage' => 60,
                'summary_of_text_reports' => 'Summary...',
                'created_by' => 4,
            ],
        ];

        foreach ($monthlyUpdates as $monthlyUpdatesData) {
            MonthlyUpdate::create($monthlyUpdatesData);
        }
    }
}
