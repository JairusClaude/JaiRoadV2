<?php

namespace Database\Seeders;

use App\Models\Engineer;
use Illuminate\Database\Seeder;

class EngineerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $engineers = [
            [
                'first_name' => 'Albert',
                'middle_name' => 'Unajan',
                'last_name' => 'Arman',
                'email' => 'aa@gmail.com',
                'contact_no' => '09000000001',
                'rank' => 'Engineer I',
                'position' => 'Field Engineer',
                'lgu_id' => 1,
                'created_by' => 1,
            ],
            [
                'first_name' => 'Bernard',
                'middle_name' => 'Guzman',
                'last_name' => 'Bertto',
                'email' => 'bb@gmail.com',
                'contact_no' => '09000000002',
                'rank' => 'Engineer II',
                'position' => 'Field Engineer',
                'lgu_id' => 2,
                'created_by' => 2,
            ],
            [
                'first_name' => 'Charles',
                'middle_name' => 'Tes',
                'last_name' => 'Lorado',
                'email' => 'cc@gmail.com',
                'contact_no' => '09000000003',
                'rank' => 'Engineer III',
                'position' => 'Resident Engineer',
                'lgu_id' => 3,
                'created_by' => 3,
            ],
            [
                'first_name' => 'Dave',
                'middle_name' => 'Kator',
                'last_name' => 'Dominic',
                'email' => 'dd@gmail.com',
                'contact_no' => '09000000004',
                'rank' => 'Engineer IV',
                'position' => 'Assistant Head',
                'lgu_id' => 4,
                'created_by' => 4,
            ],
        ];
        foreach ($engineers as $engineerData) {
            Engineer::create($engineerData);
        }
    }
}
