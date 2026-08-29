<?php

namespace Database\Seeders;

use App\Models\Lgu;
use Illuminate\Database\Seeder;

class LguSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
         $lgu = [
            [
                'municipality_name' => 'Compostela',
                'province' => 'Davao del Norte',
                'region' => 'XI',
                'contact_no' => '09000000011',
                'mayor_first_name' => 'Henry',
                'mayor_middle_name' => 'Naull',
                'mayor_last_name' => 'Burgos',
                'created_by' => 1,
            ],
            [
                'municipality_name' => 'Nabunturan',
                'province' => 'Davao de Oro',
                'region' => 'XI',
                'contact_no' => '09000000022',
                'mayor_first_name' => 'Dominic',
                'mayor_middle_name' => 'Argo',
                'mayor_last_name' => 'Santiago',
                'created_by' => 2,
            ],
            [
                'municipality_name' => 'Laak',
                'province' => 'Davao de Oro',
                'region' => 'XI',
                'contact_no' => '09000000033',
                'mayor_first_name' => 'Mark',
                'mayor_middle_name' => 'Norma',
                'mayor_last_name' => 'Nanol',
                'created_by' => 3,
            ],
            [
                'municipality_name' => 'Maco',
                'province' => 'Davao de Oro',
                'region' => 'XI',
                'contact_no' => '09000000044',
                'mayor_first_name' => 'Prestino',
                'mayor_middle_name' => 'Karpinte',
                'mayor_last_name' => 'Ybanes',
                'created_by' => 4,
            ],
        ];
        foreach ($lgu as $lguData) {
            Lgu::create($lguData);
        }
    }
}
