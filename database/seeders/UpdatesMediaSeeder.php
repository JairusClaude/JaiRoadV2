<?php

namespace Database\Seeders;

use App\Models\UpdatesMedia;
use Illuminate\Database\Seeder;

class UpdatesMediaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $updatesMedias = [
            [
                'file_name' => 'FileA',
                'file_path' => 'Projects\UpdatesMedia\FileA',
                'file_type' => 'docs',
                'monthly_updates_id' => 1,
            ],
            [
                'file_name' => 'FileB',
                'file_path' => 'Projects\UpdatesMedia\FileB',
                'file_type' => 'docs',
                'monthly_updates_id' => 2,
            ],
            [
                'file_name' => 'FileC',
                'file_path' => 'Projects\UpdatesMedia\FileC',
                'file_type' => 'docs',
                'monthly_updates_id' => 3,
            ],
            [
                'file_name' => 'FileD',
                'file_path' => 'Projects\UpdatesMedia\FileD',
                'file_type' => 'docs',
                'monthly_updates_id' => 4,
            ],
        ];
        foreach ($updatesMedias as $updatesMediasData) {
            UpdatesMedia::create($updatesMediasData);
        }
    }
}
