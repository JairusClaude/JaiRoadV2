<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Route;
use Illuminate\Routing\Route as RegisteredRoute;
use Laravel\Fortify\Features;

/**
 * Configuration-only integration preflight. Never probes network services,
 * reads private objects, queries user data, or displays credentials/URLs.
 * Passing booleans are NOT proof that external services are reachable.
 */
final class IntegrationDeploymentReadiness
{
    /** @return array{checks:array<string,bool>,ready_for_live_probes:bool,network_probes_performed:bool,manual_gates:list<string>} */
    public function report(): array
    {
        $appUrl = rtrim((string) Config::get('app.url', ''), '/');
        $documentUrl = rtrim((string) Config::get('jairoads_documents.supabase_url', ''), '/');
        $documentKey = (string) Config::get('jairoads_documents.service_role_key', '');
        $documentBucket = (string) Config::get('jairoads_documents.bucket', '');
        $mediaUrl = rtrim((string) Config::get('jairoads_monthly_updates.supabase_url', ''), '/');
        $mediaKey = (string) Config::get('jairoads_monthly_updates.service_role_key', '');

        // Monthly media may use the document secret ONLY for the identical
        // target project origin, matching PrivateMonthlyMediaStorage::token().
        if ($mediaKey === '' && $mediaUrl !== '' && $mediaUrl === $documentUrl) {
            $mediaKey = $documentKey;
        }

        $mediaBucket = (string) Config::get('jairoads_monthly_updates.bucket', '');
        $retiredFeatures = [Features::registration(), Features::resetPasswords(), Features::twoFactorAuthentication(), 'passkeys'];
        $retiredRoutes = collect(Route::getRoutes()->getRoutes())->contains(
            static function (RegisteredRoute $route): bool {
                $uri = trim($route->uri(), '/');

                return $uri === 'register'
                    || $uri === 'forgot-password'
                    || $uri === 'reset-password'
                    || str_starts_with($uri, 'reset-password/')
                    || str_starts_with($uri, 'passkeys')
                    || str_starts_with($uri, 'user/passkeys')
                    || str_starts_with($uri, 'two-factor-challenge')
                    || str_starts_with($uri, 'user/two-factor')
                    || str_starts_with($uri, 'user/confirmed-two-factor');
            },
        );

        $checks = [
            'application_origin_https' => self::httpsUrl($appUrl),
            'document_storage_https' => self::httpsUrl($documentUrl),
            'document_storage_server_secret' => self::serverOnlyToken($documentKey),
            'document_bucket_name_valid' => self::bucketName($documentBucket),
            'monthly_media_storage_https' => self::httpsUrl($mediaUrl),
            'monthly_media_server_secret' => self::serverOnlyToken($mediaKey),
            'monthly_media_bucket_name_valid' => self::bucketName($mediaBucket),
            'document_and_media_buckets_distinct' => $documentBucket !== $mediaBucket,
            'password_sign_in_and_authorized_recovery_routes' => Route::has(['login', 'login.store', 'logout', 'jairoads.workspace.accounts.password-reset']),
            'retired_authentication_features_disabled' => array_intersect($retiredFeatures, (array) Config::get('fortify.features', [])) === [],
            'retired_authentication_routes_absent' => ! $retiredRoutes,
            'map_routing_https' => self::httpsUrl((string) Config::get('jairoads_maps.routing', '')),
            'map_geocoding_https' => self::httpsUrl((string) Config::get('jairoads_maps.geocoding', '')),
        ];

        return [
            'checks' => $checks,
            'ready_for_live_probes' => in_array(false, $checks, true) === false,
            'network_probes_performed' => false,
            'manual_gates' => [
                'verify_both_storage_buckets_private_and_unversioned',
                'verify_real_private_upload_download_exact_delete_and_reconciliation',
                'verify_authorized_superadmin_password_reset_and_session_revocation',
                'verify_https_password_sign_in_all_roles_retired_endpoint_denial_and_operator_root_recovery',
                'verify_map_provider_cors_terms_rate_limits_and_actual_routes',
                'verify_real_staging_runtime_role_and_backup_restore',
            ],
        ];
    }

    private static function httpsUrl(string $url): bool
    {
        $parts = parse_url($url);

        return filter_var($url, FILTER_VALIDATE_URL) !== false
            && is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && ($parts['host'] ?? '') !== ''
            && array_key_exists('user', $parts) === false
            && array_key_exists('query', $parts) === false
            && array_key_exists('fragment', $parts) === false;
    }

    private static function bucketName(string $bucket): bool
    {
        return preg_match('/^[A-Za-z0-9_-]+$/D', $bucket) === 1;
    }

    private static function serverOnlyToken(string $token): bool
    {
        if (str_starts_with($token, 'sb_secret_')) {
            return strlen($token) > strlen('sb_secret_');
        }
        // Legacy service-role JWTs are structurally inspected only.
        // No signature check is performed; no token material is returned.
        $parts = explode('.', $token);
        if (count($parts) !== 3 || $parts[1] === '') {
            return false;
        }
        $decoded = base64_decode(strtr($parts[1], '-_', '+/'), true);
        $claims = $decoded === false ? null : json_decode($decoded, true);

        return is_array($claims) && ($claims['role'] ?? null) === 'service_role';
    }
}
