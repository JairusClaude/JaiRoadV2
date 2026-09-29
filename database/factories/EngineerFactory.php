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


    /**
     * @extends Factory<Engineer>
     */
    public function definition(): array
    {
        return [
            'first_name' => $this->faker->firstName(),
            'middle_name' => $this->faker->lastName(), // Faker does not have a middlename, lastname works
            'last_name' => $this->faker->lastName(),
            'email' => $this->faker->unique()->safeEmail(),
            'contact_no' => $this->faker->phoneNumber(),
            'rank' => $this->faker->randomElement(['Engineer I', 'Engineer II', 'Engineer III', 'Engineer IV', 'Engineer V']),
            'position' => $this->faker->jobTitle(), // possibly changed

            // Automatically creates a related LGu if one is not passed manually
            'lgu_id' => Lgu::factory(),
        ];
    }
}
