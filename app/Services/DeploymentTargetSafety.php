<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Config;

/** Configuration-only stage/production isolation and secret-free endpoint attestation. */
final class DeploymentTargetSafety
{
    /** @return array{checks:array<string,bool>,safe_for_release_probes:bool,network_probes_performed:bool,release_approved:bool} */
    public function report(): array
    {
        $type = (string) Config::get('jairoads_deployment.target_class', 'unclassified');
        $expected = (string) Config::get('jairoads_deployment.expected_supabase_ref', '');
        $official = (string) Config::get('jairoads_deployment.official_supabase_ref', '');
        $requiredRole = (string) Config::get('jairoads_deployment.restricted_database_role', 'jairoads_app_runtime');
        $supabaseUrl = rtrim((string) Config::get('jairoads_documents.supabase_url', ''), '/');
        $supabaseHost = parse_url($supabaseUrl, PHP_URL_HOST);
        $dbUrl = (string) Config::get('database.connections.pgsql.url', '');
        $databaseHost = $dbUrl !== '' ? parse_url($dbUrl, PHP_URL_HOST) : Config::get('database.connections.pgsql.host');
        $databaseUser = $dbUrl !== ''
            ? rawurldecode((string) (parse_url($dbUrl, PHP_URL_USER) ?: ''))
            : (string) Config::get('database.connections.pgsql.username', '');
        $sslMode = (string) Config::get('database.connections.pgsql.sslmode', '');
        if ($dbUrl !== '') {
            parse_str((string) (parse_url($dbUrl, PHP_URL_QUERY) ?: ''), $options);
            $sslMode = is_string($options['sslmode'] ?? null) ? $options['sslmode'] : '';
        }
        $appKey = (string) Config::get('app.key', '');
        $keyBytes = str_starts_with($appKey, 'base64:')
            ? base64_decode(substr($appKey, 7), true)
            : $appKey;
        $refValid = static fn (string $value): bool => preg_match('/^[a-z0-9]{20}$/D', $value) === 1;
        $databaseRefMatches = $refValid($expected) && (
            (is_string($databaseHost) && $databaseHost === 'db.'.$expected.'.supabase.co')
            || (is_string($databaseHost) && str_ends_with($databaseHost, '.pooler.supabase.com')
                && str_ends_with($databaseUser, '.'.$expected))
        );
        $classValid = in_array($type, ['isolated_staging', 'production'], true);

        $checks = [
            'explicit_deployment_class' => $classValid,
            'expected_supabase_project_ref' => $refValid($expected),
            'official_supabase_project_ref' => $refValid($official),
            'staging_isolated_from_official' => $classValid && $refValid($expected)
                && $refValid($official)
                && ($type !== 'isolated_staging' || $expected !== $official)
                && ($type !== 'production' || $expected === $official),
            'supabase_project_origin_matches_target' => $refValid($expected)
                && $supabaseUrl === 'https://'.$expected.'.supabase.co'
                && $supabaseHost === $expected.'.supabase.co',
            'postgres_pooler_or_direct_project_matches_target' => $databaseRefMatches,
            'restricted_runtime_username' => $requiredRole !== '' && $requiredRole !== 'postgres'
                && ($databaseUser === $requiredRole || $databaseUser === $requiredRole.'.'.$expected),
            'postgres_ssl_required' => in_array($sslMode, ['require', 'verify-ca', 'verify-full'], true),
            'postgres_driver' => Config::get('database.default') === 'pgsql',
            'https_app_origin' => str_starts_with((string) Config::get('app.url', ''), 'https://'),
            'production_safe_flags' => Config::get('app.env') === 'production' && Config::get('app.debug') === false,
            'valid_32_byte_laravel_key' => is_string($keyBytes) && strlen($keyBytes) === 32,
            // File/array sessions and caches on ephemeral app disks break session continuity on restart.
            'persistent_sessions' => in_array(Config::get('session.driver'), ['database', 'redis', 'memcached'], true),
            'persistent_cache' => in_array(Config::get('cache.default'), ['database', 'redis', 'memcached'], true),
        ];

        return [
            'checks' => $checks,
            'safe_for_release_probes' => ! in_array(false, $checks, true),
            'network_probes_performed' => false,
            'release_approved' => false,
        ];
    }
}
