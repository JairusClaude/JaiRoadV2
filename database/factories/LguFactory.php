<?php

namespace Database\Factories;

use App\Models\Lgu;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Lgu>
 */
class LguFactory extends Factory
{
    protected $model = Lgu::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $lguPool = [
            ['municipality' => 'Compostela', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Maragusan', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Monkayo', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Montevista', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'New Bataan', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Laak', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Mabini', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Maco', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Mawab', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Nabunturan', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
            ['municipality' => 'Pantukan', 'province' => 'Davao de Oro', 'region' => 'Region XI'],
        ];

        // 2. Safely pull a unique combination out of the pool
        $selectedLgu = $this->faker->unique()->randomElement($lguPool);

        return [
            'municipality_name' => $selectedLgu['municipality'],
            'province' => $selectedLgu['province'],
            'region' => $selectedLgu['region'],

            'contact_no' => $this->faker->unique()->numerify('09#########'),

            'mayor_first_name' => $this->faker->firstName(),
            'mayor_middle_name' => $this->faker->lastName(),
            'mayor_last_name' => $this->faker->lastName(),

            'created_by' => UserAccount::factory(),
        ];
    }
}
