<?php

namespace Database\Factories;

use App\Models\UserAccount;
use App\Models\Engineer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserAccount>
 */
class UserAccountFactory extends Factory
{
    protected $model = UserAccount::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'username' => $this->faker->userName(),
            'password' => $this->faker->password(6, 20),
            'role' => $this->faker->randomElement(['viewer', 'user', 'admin', 'superAdmin']),
            'is_active' => $this->faker->boolean(80), // 80% chance of true   
            
            'engineer_id' => Engineer::factory(),
            'created_by' => UserAccount::factory(),'created_by' => fn() => UserAccount::inRandomOrder()->value('id') ?? null,   
        ];
    }
}
