<?php

declare(strict_types=1);

namespace App\Services\SecurityMonitoring;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use Illuminate\Cache\RateLimiter;
use Illuminate\Database\Connection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** Bounded optional telemetry, isolated from authentication/business SQL transactions. */
final class AuthenticationTelemetry
{
    public const EVENTS = 'jairoads_security.authentication_events';

    public const PRESENCE = 'jairoads_security.active_sessions';

    public function connection(): Connection
    {
        $default = (string) config('database.default');
        $settings = config('database.connections.'.$default);
        $settings['options'][\PDO::ATTR_TIMEOUT] = 2;
        config(['database.connections.security_monitoring' => $settings]);

        return DB::connection('security_monitoring');
    }

    public function available(bool $write = false): bool
    {
        if (config('database.default') !== 'pgsql') {
            return false;
        }
        try {
            if (! $write) {
                return $this->connection()->selectOne("SELECT CASE WHEN to_regclass(?) IS NULL THEN false ELSE has_schema_privilege(current_user,'jairoads_security','USAGE') AND has_table_privilege(current_user,?,'SELECT') END AS available", [self::EVENTS, self::EVENTS])->available === true;
            }

            return $this->connection()->selectOne("SELECT CASE WHEN to_regclass(?) IS NULL OR to_regclass(?) IS NULL THEN false
                ELSE has_schema_privilege(current_user,'jairoads_security','USAGE')
                  AND has_table_privilege(current_user,?,'SELECT')
                  AND has_table_privilege(current_user,?,'INSERT')
                  AND has_table_privilege(current_user,?,'SELECT')
                  AND has_table_privilege(current_user,?,'INSERT')
                  AND has_table_privilege(current_user,?,'UPDATE')
                  AND has_table_privilege(current_user,?,'DELETE')
                  AND has_sequence_privilege(current_user,'jairoads_security.authentication_events_id_seq','USAGE') END AS available", [self::EVENTS, self::PRESENCE, self::EVENTS, self::EVENTS, self::PRESENCE, self::PRESENCE, self::PRESENCE, self::PRESENCE])->available === true;
        } catch (\Throwable) {
            return false;
        }
    }

    public static function client(Request $request): string
    {
        $ua = substr((string) $request->userAgent(), 0, 512);
        $browser = match (true) {
            str_contains($ua, 'Edg/') => 'Edge', str_contains($ua, 'OPR/') => 'Opera',
            str_contains($ua, 'Firefox/') => 'Firefox', str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari', default => 'Unknown browser',
        };
        $device = preg_match('/Android|iPhone|Mobile/i', $ua) ? 'Mobile' : (str_contains($ua, 'iPad') ? 'Tablet' : 'Desktop');

        return $browser.' / '.$device;
    }

    /** @return array{attempted_identifier:string,attempt_reference:?string} */
    public static function attempt(Request $request): array
    {
        $value = $request->input('email');
        if (! is_string($value) || trim($value) === '') {
            return ['attempted_identifier' => 'Unverified authentication attempt', 'attempt_reference' => null];
        }
        $value = mb_strtolower(mb_substr(trim($value), 0, 255));
        $parts = explode('@', $value, 2);
        $label = mb_substr($parts[0], 0, 1).'***'.(isset($parts[1]) ? '@'.mb_substr($parts[1], 0, 1).'***' : '');

        return ['attempted_identifier' => $label, 'attempt_reference' => SessionCatalog::reference($value, 'attempt')];
    }

    public function recentFailure(): ?string
    {
        try {
            $value = Cache::store((string) config('security-monitoring.cache_store'))->get('security-monitor-last-failure');

            return is_string($value) ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    public function record(Request $request, int $status): void
    {
        try {
            if (! config('security-monitoring.enabled') || ! $request->hasSession() || ! $this->available(true)) {
                return;
            }
            $logout = $request->attributes->get('security.logout');
            $login = $request->attributes->getBoolean('security.login');
            $authRoute = $request->isMethod('POST') && $request->routeIs('login.store', 'two-factor.login.store', 'passkey.login');
            $failed = $authRoute && ($request->attributes->getBoolean('security.failed') || in_array($status, [401, 403, 422, 429], true)
                || ($status === 302 && $request->session()->has('errors')));
            $user = $logout instanceof User ? $logout : $request->user();
            $fresh = $user instanceof User ? User::query()->find($user->getKey()) : null;
            $actor = $fresh instanceof User ? app(AccountIdentityResolver::class)->resolve($fresh) : null;
            $event = $failed ? 'FAILED_LOGIN' : (($logout instanceof User && $status < 400) ? 'LOGOUT' : (($login && $actor !== null && $status < 400) ? 'LOGIN' : null));
            if ($failed) {
                $limiter = new RateLimiter(Cache::store((string) config('security-monitoring.cache_store')));
                $key = 'security-monitor-failed:'.SessionCatalog::reference((string) $request->ip(), 'network');
                if ($limiter->tooManyAttempts($key, (int) config('security-monitoring.failure_limit_per_network_hour'))
                    || $limiter->tooManyAttempts('security-monitor-global-failures', (int) config('security-monitoring.failure_limit_per_hour'))) {
                    return;
                }
                $limiter->hit($key, 3600);
                $limiter->hit('security-monitor-global-failures', 3600);
            }
            if ($event === 'LOGIN' && $fresh instanceof User && in_array(config('session.driver'), ['file', 'database'], true)) {
                if (! app(SessionCatalog::class)->matchesSession($request->session()->getId(), ['login_id' => (int) $fresh->getKey()] + SessionCatalog::credentialState($fresh->getAuthPassword()))) {
                    return;
                }
            }
            $db = $this->connection();
            $db->transaction(function () use ($db, $request, $actor, $fresh, $event, $status): void {
                $db->statement("SET LOCAL lock_timeout='250ms'");
                $db->statement("SET LOCAL statement_timeout='750ms'");
                if ($event === 'FAILED_LOGIN') {
                    if (! $db->selectOne('SELECT pg_try_advisory_xact_lock(1927710950) AS locked')->locked
                        || $db->table(self::EVENTS)->where('event', 'FAILED_LOGIN')->where('created_at', '>=', now()->startOfHour()->utc()->toIso8601String())->count() >= (int) config('security-monitoring.failure_limit_per_hour')) {
                        return;
                    }
                }
                $reference = $event === 'LOGOUT' ? $request->attributes->get('security.logout_reference') : SessionCatalog::reference($request->session()->getId());
                if ($event !== null) {
                    $verified = $event !== 'FAILED_LOGIN' && $actor !== null;
                    $db->table(self::EVENTS)->insert([
                        'user_account_id' => $verified ? $actor['account_id'] : null,
                        'actor_identifier' => $verified ? 'DD-UserAccount#'.$actor['account_id'].' ('.$db->table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->value('username').')' : null,
                        'account_type' => $verified ? $actor['role'] : null,
                        ...($event === 'FAILED_LOGIN' ? self::attempt($request) : ['attempted_identifier' => null, 'attempt_reference' => null]),
                        'event' => $event, 'outcome' => match ($event) {
                            'LOGIN' => 'Successful', 'LOGOUT' => 'Completed', default => 'Rejected'
                        },
                        'method' => $request->routeIs('passkey.login') ? 'passkey' : ($request->routeIs('two-factor.login.store') ? 'mfa' : ($request->routeIs('login.store') ? 'password' : ($event === 'LOGIN' ? 'remember' : 'session'))),
                        'client_description' => self::client($request), 'session_reference' => $event === 'FAILED_LOGIN' ? null : $reference,
                        'created_at' => now()->utc()->toIso8601String(),
                    ]);
                }
                if ($event === 'LOGOUT') {
                    $db->table(self::PRESENCE)->where('session_reference', $reference)->delete();
                } elseif ($actor !== null && $status < 400 && in_array(config('session.driver'), ['file', 'database'], true)) {
                    $credential = SessionCatalog::reference($fresh->getAuthPassword(), 'credential');
                    $old = $db->table(self::PRESENCE)->where('session_reference', $reference)->first();
                    if (! $old || ! hash_equals($old->credential_reference, $credential) || now()->subSeconds((int) config('security-monitoring.touch_seconds'))->greaterThan($old->last_activity)) {
                        $db->table(self::PRESENCE)->upsert([[
                            'session_reference' => $reference, 'user_account_id' => $actor['account_id'], 'credential_reference' => $credential,
                            'login_at' => $request->session()->get('security.login_at'), 'last_activity' => now()->utc()->toIso8601String(), 'client_description' => self::client($request),
                        ]], ['session_reference'], ['user_account_id', 'credential_reference', 'login_at', 'last_activity', 'client_description']);
                    }
                    $expired = $db->table(self::PRESENCE)->where('last_activity', '<', now()->subMinutes(max(5, (int) config('session.lifetime')))->utc()->toIso8601String())->limit(100)->pluck('session_reference');
                    if ($expired->isNotEmpty()) {
                        $db->table(self::PRESENCE)->whereIn('session_reference', $expired)->delete();
                    }
                }
            });
        } catch (\Throwable) {
            // Never expose exception text, credentials, client input, or private paths.
            try {
                Cache::store((string) config('security-monitoring.cache_store'))->put('security-monitor-last-failure', now()->utc()->toIso8601String(), 600);
                if (Cache::store((string) config('security-monitoring.cache_store'))->add('security-monitor-warning', true, 120)) {
                    Log::warning('Security monitoring collection unavailable; authentication response preserved.');
                }
            } catch (\Throwable) {
                // A diagnostic sink outage cannot change authentication or business commits.
            }
        }
    }
}
