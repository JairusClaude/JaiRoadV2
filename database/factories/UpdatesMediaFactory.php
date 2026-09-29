<?php

namespace Database\Factories;

use App\Models\MonthlyUpdate;
use App\Models\UpdatesMedia;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UpdatesMedia>
 */
class UpdatesMediaFactory extends Factory
{
    protected $model = UpdatesMedia::class;


    /**
     * @extends Factory<UpdatesMedia>
     */
    public function definition(): array
    {
        return [
            'file_name' => $this->faker->word(),
            'file_path' => $this->faker->filePath(),
            'file_type' => $this->faker->randomElement(['pdf', 'xlsx', 'docx', 'pptx']),

            'monthly_update_id' => MonthlyUpdate::factory(),
            'created_by' => UserAccount::factory(),
        ];
    }
}
