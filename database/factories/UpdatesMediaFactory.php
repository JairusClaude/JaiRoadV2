<?php

namespace Database\Factories;

use App\Models\MonthlyUpdate;
use App\Models\UpdatesMedia;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UpdatesMedia>
 */
class UpdatesMediaFactory extends Factory
{
    protected $model = UpdatesMedia::class;

    public function definition(): array
    {
        $fileName = fake()->uuid().'.pdf';

        return [
            'file_name' => $fileName,
            'file_path' => 'updates/'.$fileName,
            'file_type' => 'docs',
            'monthly_updates_id' => MonthlyUpdate::factory(),
        ];
    }
}
