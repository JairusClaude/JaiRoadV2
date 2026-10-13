<?php

namespace Database\Factories;

use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<UserAccount>
 */
class UserAccountFactory extends Factory
{
    protected $model = UserAccount::class;

    public function definition(): array
    {
        return [
            'username' => fake()->unique()->userName(),
            'password' => Hash::make('password'),
            'accountType' => fake()->randomElement([
                'viewer',
                'user',
                'admin',
            ]),
            'is_active' => fake()->boolean(80),
            'engineers_id' => null,
            'created_by' => null,
        ];
    }
}
