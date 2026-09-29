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
     * @extends Factory<UserAccount>
     */
    public function definition(): array
    {
        return [
            'username'     => $this->faker->userName(),
            'password'     => $this->faker->password(6, 20),
            
            // Fixed: Changed from 'role' to match your model's fillable 'accountType'
            'accountType'  => $this->faker->randomElement(['viewer', 'user', 'admin', 'superAdmin']),
            
            'is_active'    => $this->faker->boolean(80), 
            
            // Fixed: Changed from 'engineer_id' to match your model's 'engineers_id'
            'engineers_id' => fn() => Engineer::inRandomOrder()->value('id') ?? Engineer::factory(),
            
            'created_by'   => fn() => UserAccount::inRandomOrder()->value('id') ?? null,   
        ];
    }
}
