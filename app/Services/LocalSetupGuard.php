<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

/** The convenience setup script is for explicitly disposable local databases only. */
final class LocalSetupGuard
{
    /** @param array<string, string> $environment */
    public static function validate(array $environment): void
    {
        if (($environment['JAIROADS_SCRATCH_APPROVAL'] ?? '') !== 'DISPOSABLE_LOCAL_ONLY'
            || ! in_array($environment['APP_ENV'] ?? '', ['local', 'testing'], true)
            || array_key_exists('RENDER', $environment)) {
            throw new RuntimeException('Setup refused: explicitly approved disposable local/testing configuration is required.');
        }
        $driver = $environment['DB_CONNECTION'] ?? '';
        $host = $environment['DB_HOST'] ?? '';
        $database = $environment['DB_DATABASE'] ?? '';
        $url = $environment['DB_URL'] ?? '';
        if ($url !== '') {
            $parts = parse_url($url);
            if ($parts === false || ! in_array($parts['scheme'] ?? '', ['postgres', 'postgresql', 'pgsql'], true)) {
                throw new RuntimeException('Setup refused: unsupported database URL.');
            }
            parse_str($parts['query'] ?? '', $query);
            if (array_diff(array_keys($query), ['sslmode']) !== []) {
                throw new RuntimeException('Setup refused: database URL connection overrides are not permitted.');
            }
            $driver = 'pgsql';
            $host = $parts['host'] ?? '';
            $database = rawurldecode(ltrim($parts['path'] ?? '', '/'));
        }
        if ($driver === 'sqlite' && $url === '') {
            // Never initialize an existing local business database by filename assumption.
            if ($database === ':memory:') {
                return;
            }
            throw new RuntimeException('Setup refused: SQLite setup requires an isolated in-memory database.');
        }
        if ($driver !== 'pgsql' || ! in_array($host, ['127.0.0.1', 'localhost', '[::1]', '::1'], true)
            || preg_match('/\Ajairoads_scratch_[a-z0-9_]+\z/', $database) !== 1) {
            throw new RuntimeException('Setup refused: PostgreSQL must use loopback and a jairoads_scratch_* database.');
        }
    }
}
