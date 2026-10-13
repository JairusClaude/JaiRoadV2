<?php

namespace Database\Factories;

use App\Models\Engineer;
use App\Models\Lgu;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Engineer>
 */
class EngineerFactory extends Factory
{
    protected $model = Engineer::class;

    public function definition(): array
    {
        return [
            'first_name' => fake()->firstName(),
            'middle_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->safeEmail(),
            'contact_no' => fake()->numerify('09#########'),
            'rank' => fake()->randomElement([
                'Engineer I',
                'Engineer II',
                'Engineer III',
                'Engineer IV',
                'Engineer V',
            ]),
            'position' => fake()->jobTitle(),
            'lgus_id' => Lgu::factory(),
        ];
    }
}
