<?php

namespace Database\Seeders;

use App\Models\UserAccount;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserAccountSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $userAccounts = [
            [
                'username' => 'User1',
                'password' => Hash::make('pass1'),
                'accountType' => 'admin',
                'is_active' => true,
                'engineers_id' => 1,
            ],
            [
                'username' => 'User2',
                'password' => Hash::make('pass2'),
                'accountType' => 'user',
                'is_active' => true,
                'engineers_id' => 2,
            ],
            [
                'username' => 'User3',
                'password' => Hash::make('pass3'),
                'accountType' => 'user',
                'is_active' => true,
                'engineers_id' => 3,
            ],
            [
                'username' => 'User4',
                'password' => Hash::make('pass4'),
                'accountType' => 'user',
                'is_active' => true,
                'engineers_id' => 4,
            ],
        ];
        foreach ($userAccounts as $userAccountsData) {
            UserAccount::create($userAccountsData);
        }
    }
}
