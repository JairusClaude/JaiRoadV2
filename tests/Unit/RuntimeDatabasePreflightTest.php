<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Console\Commands\RuntimeDatabasePreflight;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

final class RuntimeDatabasePreflightTest extends TestCase
{
    public function test_non_postgres_environment_fails_closed_without_sensitive_output(): void
    {
        config()->set('database.default', 'sqlite');
        $this->assertSame(1, Artisan::call('jairoads:runtime-db-preflight'));
        $output = Artisan::output();
        $this->assertStringNotContainsString('DB_PASSWORD', $output);
        $this->assertStringNotContainsString('SUPABASE_SECRET_KEY', $output);
    }

    public function test_command_has_explicit_read_only_role_guard(): void
    {
        $this->assertSame('jairoads:runtime-db-preflight', (new RuntimeDatabasePreflight)->getName());
    }
}
