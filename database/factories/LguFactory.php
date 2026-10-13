<?php

namespace Database\Factories;

use App\Models\Lgu;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Lgu>
 */
class LguFactory extends Factory
{
    protected $model = Lgu::class;

    public function definition(): array
    {
        $lguPool = [
            'Compostela',
            'Maragusan',
            'Monkayo',
            'Montevista',
            'New Bataan',
            'Laak',
            'Mabini',
            'Maco',
            'Mawab',
            'Nabunturan',
            'Pantukan',
        ];

        return [
            'municipality_name' => fake()->randomElement($lguPool),
            'province' => 'Davao de Oro',
            'region' => 'XI',
            'contact_no' => fake()->numerify('09#########'),
            'mayor_first_name' => fake()->firstName(),
            'mayor_middle_name' => fake()->firstName(),
            'mayor_last_name' => fake()->lastName(),
        ];
    }
}
