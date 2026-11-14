<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\LocalSetupGuard;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class LocalSetupGuardTest extends TestCase
{
    /** @return array<string,string> */
    private function environment(): array
    {
        return ['APP_ENV' => 'testing', 'JAIROADS_SCRATCH_APPROVAL' => 'DISPOSABLE_LOCAL_ONLY',
            'DB_CONNECTION' => 'pgsql', 'DB_HOST' => '127.0.0.1', 'DB_DATABASE' => 'jairoads_scratch_setup', 'DB_URL' => ''];
    }

    public static function rejected(): iterable
    {
        yield 'missing approval' => [['JAIROADS_SCRATCH_APPROVAL' => '']];
        yield 'production' => [['APP_ENV' => 'production']];
        yield 'Render' => [['RENDER' => 'true']];
        yield 'remote database' => [['DB_HOST' => 'db.example.supabase.co']];
        yield 'shared name on localhost' => [['DB_DATABASE' => 'postgres']];
        yield 'URL overrides safe host' => [['DB_URL' => 'postgresql://fixture:disposable@db.example.supabase.co/jairoads_scratch_setup']];
        yield 'URL overrides scratch name' => [['DB_URL' => 'postgresql://fixture:disposable@localhost/postgres']];
        yield 'query overrides host' => [['DB_URL' => 'postgresql://fixture:disposable@localhost/jairoads_scratch_setup?host=db.example.supabase.co']];
        yield 'query overrides database' => [['DB_URL' => 'postgresql://fixture:disposable@localhost/jairoads_scratch_setup?database=postgres']];
        yield 'unsupported URL' => [['DB_URL' => 'https://example.test/database']];
        yield 'unsupported driver' => [['DB_CONNECTION' => 'mysql']];
        yield 'persistent SQLite' => [['DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => 'database/database.sqlite']];
    }

    #[DataProvider('rejected')]
    public function test_refuses_unsafe_setup_before_any_connection(array $changes): void
    {
        $this->expectException(RuntimeException::class);
        LocalSetupGuard::validate(array_replace($this->environment(), $changes));
    }

    public function test_composer_initialization_checks_target_before_migrations_or_key_replacement(): void
    {
        $composer = json_decode(file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
        foreach (['setup', 'post-create-project-cmd'] as $script) {
            $commands = $composer['scripts'][$script];
            $guard = array_search('@php tools/guard-local-setup.php', $commands, true);
            $this->assertIsInt($guard);
            foreach ($commands as $index => $command) {
                if (str_contains($command, 'artisan migrate') || str_contains($command, 'artisan key:generate')) {
                    $this->assertLessThan($index, $guard);
                }
            }
        }
    }

    public function test_allows_only_explicit_disposable_postgres_or_memory_sqlite(): void
    {
        LocalSetupGuard::validate($this->environment());
        LocalSetupGuard::validate(array_replace($this->environment(), ['DB_URL' => 'postgresql://fixture:disposable@localhost:5432/jairoads_scratch_setup?sslmode=disable']));
        LocalSetupGuard::validate(array_replace($this->environment(), ['DB_CONNECTION' => 'sqlite', 'DB_DATABASE' => ':memory:']));
        $this->addToAssertionCount(3);
    }
}
