<?php

namespace Database\Seeders;

use App\Models\UserAccounts;
use Illuminate\Database\Seeder;

class UserAccountsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $userAccounts = [
            [
                'username' => 'User1',
                'password' => 'pass1',
                'role' => 'admin',
                'is_active' => true,
                'engineer_id' => 1,
            ],
            [
                'username' => 'User2',
                'password' => 'pass2',
                'role' => 'user',
                'is_active' => true,
                'engineer_id' => 2,
            ],
            [
                'username' => 'User3',
                'password' => 'pass3',
                'role' => 'user',
                'is_active' => true,
                'engineer_id' => 3,
            ],
            [
                'username' => 'User4',
                'password' => 'pass4',
                'role' => 'user',
                'is_active' => true,
                'engineer_id' => 4,
            ],
        ];
        foreach ($userAccounts as $userAccountsData) {
            UserAccounts::create($userAccountsData);
        }
    }
}
