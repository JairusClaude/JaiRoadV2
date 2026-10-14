<?php

namespace Database\Seeders;

use App\Models\MaintenanceRecord;
use Illuminate\Database\Seeder;

class MaintenanceRecordSeeder extends Seeder
{
    public function run(): void
    {
        MaintenanceRecord::factory()
            ->count(10)
            ->create();
    }
}
