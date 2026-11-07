<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\TrustedSuperAdminBootstrap;
use Illuminate\Console\Command;

final class BootstrapCanonicalSuperAdmin extends Command
{
    protected $signature = 'jairoads:bootstrap-superadmin';

    protected $description = 'Trusted database operator only: atomically provision the first canonical SuperAdmin';

    public function handle(TrustedSuperAdminBootstrap $bootstrap): int
    {
        if (! $this->input->isInteractive() || $this->ask('Type TRUSTED DATABASE OPERATOR to proceed') !== 'TRUSTED DATABASE OPERATOR') {
            $this->error('Interactive trusted-operator acknowledgement is required.');

            return self::FAILURE;
        }
        $username = (string) $this->ask('Unique username');
        $email = (string) $this->ask('Email');
        $name = (string) $this->ask('Display name');
        $password = (string) $this->secret('Unique password (12+ characters, mixed case, number and symbol)');
        if (! hash_equals($password, (string) $this->secret('Confirm password'))) {
            $this->error('Password confirmation does not match.');

            return self::FAILURE;
        }
        $id = $bootstrap->create($username, $email, $name, $password);
        $this->info('Created canonical SuperAdmin #'.$id.' and its explicitly linked Fortify identity.');

        return self::SUCCESS;
    }
}
