<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\SecurityMonitoring\AuthenticationTelemetry;
use App\Services\SecurityMonitoring\OnlinePresence;
use App\Services\SecurityMonitoring\SessionCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Session\EncryptedStore;
use Illuminate\Session\FileSessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;

final class SecurityMonitoringTest extends PostgresTestCase
{
    private User $root;

    private string $sessions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sessions = storage_path('framework/testing-monitor-'.Str::random(12));
        File::makeDirectory($this->sessions, 0700, true);
        config(['session.driver' => 'file', 'session.files' => $this->sessions, 'security-monitoring.cache_store' => 'array', 'database.connections.pgsql.timezone' => 'Asia/Manila']);
        DB::statement("SET TIME ZONE 'Asia/Manila'");
        Session::forgetDrivers();
        DB::unprepared(file_get_contents(base_path('database/proposals/security_monitoring.sql')));
        $this->root = $this->account('SuperAdmin');
    }

    protected function tearDown(): void
    {
        try {
            DB::purge('security_monitoring');
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            // Positively guarded disposable fixture cleanup only; no runtime clearing capability.
            PostgresTestSchema::prepare();
            DB::unprepared('DROP TABLE IF EXISTS jairoads_security.active_sessions; DROP TABLE IF EXISTS jairoads_security.authentication_events; DROP FUNCTION IF EXISTS jairoads_security.reject_authentication_history_mutation()');
            PostgresTestSchema::clearCommittedFixtures();
            File::deleteDirectory($this->sessions);
        } finally {
            parent::tearDown();
        }
    }

    private function ready(): void
    {
        DB::commit();
    }

    private function login(User $user): void
    {
        $this->postJson('/login', ['email' => $user->email, 'password' => 'Disposable-Test!123'])->assertOk();
        $this->withCredentials()->withCookie((string) config('session.cookie'), session()->getId());
    }

    private function events(): Builder
    {
        return DB::table(AuthenticationTelemetry::EVENTS);
    }

    private function props(): array
    {
        return $this->get('/dd-phase3/audit-logs')->assertOk()->viewData('page')['props'];
    }

    public static function roles(): iterable
    {
        foreach (['Admin', 'SuperAdmin', 'Engineer', 'Viewer'] as $role) {
            yield [$role];
        }
    }

    #[DataProvider('roles')]
    public function test_only_currently_eligible_administrators_can_read_every_table(string $role): void
    {
        $actor = $role === 'SuperAdmin' ? $this->root : $this->account($role);
        $this->ready();
        $this->actingAs($actor);
        $response = $this->get('/dd-phase3/audit-logs?auth_event=FAILED_LOGIN&activity_search=test');
        if (in_array($role, ['Admin', 'SuperAdmin'], true)) {
            $response->assertOk()->assertInertia(fn (Assert $page) => $page->component('dd-phase3/AuditHistory')->has('events.data')->has('authentication.data')->has('presence.accounts'));
        } else {
            $response->assertForbidden();
        }
        DB::table('jairoads_next.user_accounts')->where('id', $actor->dd_user_account_id)->update(['is_active' => false]);
        $this->get('/dd-phase3/audit-logs')->assertForbidden();
    }

    public function test_guest_has_no_history_access_or_destructive_history_route(): void
    {
        $this->ready();
        $this->getJson('/dd-phase3/audit-logs')->assertUnauthorized();
        $this->actingAs($this->root);
        foreach (['postJson', 'putJson', 'deleteJson'] as $method) {
            $this->$method('/dd-phase3/audit-logs/1', [])->assertNotFound();
        }
        $this->postJson('/dd-phase3/audit-logs/reset', [])->assertNotFound();
    }

    public function test_completed_password_login_and_real_logout_are_separate_from_business_auditing(): void
    {
        $this->ready();
        $this->login($this->root);
        $this->assertSame(['LOGIN'], $this->events()->pluck('event')->all());
        $event = $this->events()->first();
        $this->assertSame($this->root->dd_user_account_id, $event->user_account_id);
        $this->assertSame('SuperAdmin', $event->account_type);
        $this->assertSame('Successful', $event->outcome);
        $this->assertLessThan(2, abs(CarbonImmutable::parse($event->created_at)->diffInSeconds(now())));
        $this->assertSame(1, app(OnlinePresence::class)->read()['total']);
        $rawId = session()->getId();
        $this->assertStringNotContainsString($rawId, $this->events()->get()->toJson());
        $this->postJson('/logout')->assertNoContent();
        $this->assertSame(['LOGIN', 'LOGOUT'], $this->events()->orderBy('id')->pluck('event')->all());
        $this->assertSame(0, app(OnlinePresence::class)->read()['total']);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_notification_recipients')->count());
    }

    public function test_failed_unknown_credentials_are_masked_unverified_sanitized_and_rate_bounded(): void
    {
        $this->ready();
        config(['security-monitoring.failure_limit_per_network_hour' => 2]);
        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/login', ['email' => 'unknown'.$i.'@private.example.test', 'password' => 'SECRET-NEVER-LOG'])->assertUnprocessable();
        }
        $this->assertSame(2, $this->events()->count());
        foreach ($this->events()->get() as $event) {
            $this->assertNull($event->user_account_id);
            $this->assertNull($event->account_type);
            $this->assertNull($event->actor_identifier);
            $this->assertSame('FAILED_LOGIN', $event->event);
        }
        $payload = $this->events()->get()->toJson();
        foreach (['SECRET-NEVER-LOG', 'private.example.test', '127.0.0.1'] as $secret) {
            $this->assertStringNotContainsString($secret, $payload);
        }
        $this->assertSame(0, DB::table(AuthenticationTelemetry::PRESENCE)->count());
    }

    public function test_authentication_rate_limit_remains_effective_and_no_success_is_recorded(): void
    {
        $this->ready();
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/login', ['email' => $this->root->email, 'password' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/login', ['email' => $this->root->email, 'password' => 'Disposable-Test!123'])->assertTooManyRequests();
        $this->assertSame(0, $this->events()->where('event', 'LOGIN')->count());
    }

    public function test_incomplete_mfa_records_no_login_and_wrong_code_records_only_rejection(): void
    {
        $this->root->forceFill(['two_factor_secret' => encrypt('JBSWY3DPEHPK3PXP'), 'two_factor_recovery_codes' => encrypt(json_encode(['synthetic-recovery'])), 'two_factor_confirmed_at' => now()])->save();
        $this->ready();
        $this->postJson('/login', ['email' => $this->root->email, 'password' => 'Disposable-Test!123'])->assertOk();
        $this->assertGuest();
        $this->assertSame(0, $this->events()->count());
        $this->postJson('/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();
        $this->assertSame(['FAILED_LOGIN'], $this->events()->pluck('event')->all());
        $this->postJson('/two-factor-challenge', ['recovery_code' => 'synthetic-recovery'])->assertNoContent();
        $this->assertSame(1, $this->events()->where('event', 'LOGIN')->where('method', 'mfa')->count());
        $this->assertStringNotContainsString('synthetic-recovery', $this->events()->get()->toJson());
    }

    public static function writeFailures(): iterable
    {
        yield [AuthenticationTelemetry::EVENTS];
        yield [AuthenticationTelemetry::PRESENCE];
    }

    #[DataProvider('writeFailures')]
    public function test_telemetry_sql_failure_preserves_real_authentication_without_false_success_or_partial_presence(string $table): void
    {
        $this->ready();
        app(AuthenticationTelemetry::class)->connection()->beforeExecuting(static function (string $sql) use ($table): void {
            $name = explode('.', $table)[1];
            if (str_starts_with($sql, 'insert into "jairoads_security"."'.$name.'"')) {
                throw new \RuntimeException('Disposable telemetry failure');
            }
        });
        $this->login($this->root);
        $this->assertAuthenticatedAs($this->root);
        $this->assertSame(0, $this->events()->count());
        $this->assertSame(0, DB::table(AuthenticationTelemetry::PRESENCE)->count());
        $this->get('/dd-superadmin-landing')->assertOk();
    }

    public function test_missing_schema_preserves_authentication_and_business_history_with_explicit_unavailable_state(): void
    {
        DB::unprepared('DROP TABLE jairoads_security.active_sessions');
        $this->ready();
        $this->login($this->root);
        $this->get('/dd-phase3/audit-logs')->assertOk()->assertInertia(fn (Assert $page) => $page->where('monitoring.available', true)->where('monitoring.collecting', false)->where('presence.available', false));
        $this->assertSame(0, $this->events()->count());
    }

    public function test_real_telemetry_lock_wait_is_bounded_and_does_not_change_login(): void
    {
        $this->ready();
        DB::beginTransaction();
        DB::statement('LOCK TABLE jairoads_security.authentication_events IN ACCESS EXCLUSIVE MODE');
        $started = microtime(true);
        $this->login($this->root);
        $this->assertLessThan(2.0, microtime(true) - $started);
        DB::rollBack();
        $this->assertSame(0, $this->events()->count());
        $this->assertSame(0, DB::table(AuthenticationTelemetry::PRESENCE)->count());
        $this->assertAuthenticatedAs($this->root);
    }

    public function test_failed_session_persistence_is_not_reported_as_successful_login(): void
    {
        $sessionPath = $this->sessions;
        Session::extend('file', fn () => new class(app('files'), $sessionPath, 120) extends FileSessionHandler
        {
            public function write($id, $data): bool
            {
                return false;
            }
        });
        Session::forgetDrivers();
        $this->ready();
        $this->postJson('/login', ['email' => $this->root->email, 'password' => 'Disposable-Test!123'])->assertOk();
        $this->assertSame(0, $this->events()->count());
        $this->assertSame(0, DB::table(AuthenticationTelemetry::PRESENCE)->count());
    }

    public function test_global_failure_budget_cannot_be_bypassed_by_rotating_networks_or_identifiers(): void
    {
        $this->ready();
        config(['security-monitoring.failure_limit_per_hour' => 2]);
        for ($i = 1; $i <= 4; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.'.$i])->postJson('/login', [
                'email' => 'unverified-'.$i.'@example.test', 'password' => 'wrong',
            ])->assertUnprocessable();
        }
        $this->assertSame(2, $this->events()->count());
    }

    public function test_presence_capacity_failure_is_explicit_instead_of_showing_unverified_counts(): void
    {
        $this->ready();
        $this->savedSession($this->root);
        $this->savedSession($this->root);
        config(['security-monitoring.max_recent_sessions' => 1]);
        $presence = app(OnlinePresence::class)->read();
        $this->assertFalse($presence['available']);
        $this->assertSame([], $presence['accounts']);
        config(['security-monitoring.max_session_files' => 0]);
        $this->login($this->root);
        $this->assertSame(1, $this->events()->where('event', 'LOGIN')->count());
    }

    public function test_disabling_collection_preserves_retained_authentication_reads(): void
    {
        $this->ready();
        $this->login($this->root);
        config(['security-monitoring.enabled' => false]);
        $this->get('/dd-phase3/audit-logs')->assertOk()->assertInertia(fn (Assert $page) => $page->where('monitoring.available', true)->where('monitoring.collecting', false)->has('authentication.data', 1)->where('presence.available', false));
        $this->postJson('/logout')->assertNoContent();
        $this->assertSame(['LOGIN'], $this->events()->pluck('event')->all());
    }

    private function savedSession(User $user, bool $encrypted = false): string
    {
        $id = Str::random(40);
        $store = $encrypted ? new EncryptedStore('test', clone Session::driver()->getHandler(), app('encrypter'), $id, config('session.serialization'))
            : new Store('test', clone Session::driver()->getHandler(), $id, config('session.serialization'));
        $store->put(Auth::guard()->getName(), $user->id);
        $store->put('password_hash_web', $user->password);
        $store->save();
        DB::table(AuthenticationTelemetry::PRESENCE)->insert(['session_reference' => SessionCatalog::reference($id),
            'credential_reference' => SessionCatalog::reference($user->password, 'credential'), 'user_account_id' => $user->dd_user_account_id,
            'login_at' => now()->utc()->toIso8601String(), 'last_activity' => now()->utc()->toIso8601String(), 'client_description' => 'Firefox / Desktop']);

        return $id;
    }

    public function test_multiple_devices_count_once_logout_invalidation_expiry_and_activity_thresholds_are_respected(): void
    {
        $this->ready();
        $first = $this->savedSession($this->root);
        $second = $this->savedSession($this->root);
        $presence = app(OnlinePresence::class)->read();
        $this->assertTrue($presence['available']);
        $this->assertSame(1, $presence['total']);
        $this->assertSame(2, $presence['accounts'][0]['session_count']);
        $this->assertStringNotContainsString($first, json_encode($presence));
        unlink($this->sessions.'/'.$first);
        $this->assertSame(1, app(OnlinePresence::class)->read()['accounts'][0]['session_count']);
        touch($this->sessions.'/'.$second, time() - 60 * ((int) config('session.lifetime') + 1));
        clearstatcache();
        $this->assertSame(0, app(OnlinePresence::class)->read()['total']);
        touch($this->sessions.'/'.$second);
        clearstatcache();
        DB::table(AuthenticationTelemetry::PRESENCE)->update(['last_activity' => now()->subMinutes(6)->utc()->toIso8601String()]);
        $this->assertSame(0, app(OnlinePresence::class)->read()['total']);
        $this->assertSame(0, $this->events()->where('event', 'LOGOUT')->count());
    }

    public static function revocations(): iterable
    {
        foreach (['inactive', 'retired', 'password', 'link'] as $case) {
            yield [$case];
        }
    }

    #[DataProvider('revocations')]
    public function test_revoked_identity_or_credential_state_cannot_remain_online(string $case): void
    {
        $engineer = $this->engineer();
        $user = $this->account('Engineer', $engineer);
        $this->ready();
        $this->savedSession($user);
        $this->assertSame(1, app(OnlinePresence::class)->read()['total']);
        if ($case === 'inactive') {
            DB::table('jairoads_next.user_accounts')->where('id', $user->dd_user_account_id)->update(['is_active' => false]);
        }
        if ($case === 'retired') {
            DB::table('jairoads_next.engineers')->where('id', $engineer)->update(['engineer_status' => 'Retired']);
        }
        if ($case === 'link') {
            DB::table('public.users')->where('id', $user->id)->update(['dd_user_account_id' => null]);
        }
        if ($case === 'password') {
            $hash = Hash::make('Changed-Synthetic!123');
            DB::table('public.users')->where('id', $user->id)->update(['password' => $hash]);
            DB::table('jairoads_next.user_accounts')->where('id', $user->dd_user_account_id)->update(['password' => $hash]);
            // Even a late tracker touch cannot revive a session carrying the old hash.
            DB::table(AuthenticationTelemetry::PRESENCE)->update(['credential_reference' => SessionCatalog::reference($hash, 'credential')]);
        }
        $this->assertSame(0, app(OnlinePresence::class)->read()['total']);
    }

    public function test_encrypted_file_sessions_and_unsupported_driver_reporting(): void
    {
        config(['session.encrypt' => true]);
        Session::forgetDrivers();
        $this->ready();
        $this->savedSession($this->root, true);
        $this->assertSame(1, app(OnlinePresence::class)->read()['total']);
        config(['session.driver' => 'cookie']);
        $this->assertFalse(app(OnlinePresence::class)->read()['available']);
    }

    public function test_laravel_session_credential_hmac_is_supported_without_accepting_a_stale_password(): void
    {
        $this->ready();
        $id = $this->savedSession($this->root);
        $store = new Store('test', clone Session::driver()->getHandler(), $id, config('session.serialization'));
        $store->start();
        $store->put('password_hash_web', Auth::guard()->hashPasswordForCookie($this->root->password));
        $store->save();
        $this->assertSame(1, app(OnlinePresence::class)->read()['total']);
        $this->assertSame('Active', app(OnlinePresence::class)->read()['accounts'][0]['status']);
        $store->put('password_hash_web', Auth::guard()->hashPasswordForCookie('stale-password-state'));
        $store->save();
        $this->assertSame(0, app(OnlinePresence::class)->read()['total']);
    }

    public function test_database_session_driver_verifies_actual_server_expiry(): void
    {
        DB::unprepared('CREATE TABLE public.sessions (id varchar(255) PRIMARY KEY,user_id bigint,ip_address varchar(45),user_agent text,payload text NOT NULL,last_activity integer NOT NULL)');
        config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
        Session::forgetDrivers();
        $this->ready();
        $id = $this->savedSession($this->root);
        $this->assertSame(1, app(OnlinePresence::class)->read()['total']);
        DB::table('public.sessions')->where('id', $id)->update(['last_activity' => now()->subMinutes((int) config('session.lifetime') + 1)->timestamp]);
        $this->assertSame(0, app(OnlinePresence::class)->read()['total']);
    }

    public function test_history_filtering_pagination_sanitization_role_caveat_and_immutability(): void
    {
        for ($i = 0; $i < 30; $i++) {
            DB::table('jairoads_next.audit_logs')->insert(['user_id' => $this->root->dd_user_account_id, 'actor_identifier' => 'Original username', 'action' => $i === 0 ? 'DELETE' : 'UPDATE',
                'entity_type' => 'UserAccount', 'entity_id' => 78, 'description' => 'Changed account test',
                'old_value' => json_encode(['username' => 'old', 'password' => 'NEVER-EXPOSE']), 'new_value' => json_encode(['username' => 'new', 'mfa_secret' => 'NEVER-EXPOSE']), 'created_at' => '2026-11-09 18:00:00']);
        }
        $before = DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();
        DB::table('jairoads_next.user_accounts')->where('id', $this->root->dd_user_account_id)->update(['username' => 'Renamed administrator']);
        $this->ready();
        $this->actingAs($this->root);
        $this->get('/dd-phase3/audit-logs?activity_search=78&activity_from=2026-11-10&activity_to=2026-11-10&activity_order=oldest')->assertOk()
            ->assertDontSee('NEVER-EXPOSE')->assertInertia(fn (Assert $page) => $page->has('events.data', 25)->where('events.total', 30)->where('events.data.0.actor_identifier', 'Original username')->where('events.data.0.old_value', ['username' => 'old']));
        $this->get('/dd-phase3/audit-logs?activity_action=DELETE&activity_entity=UserAccount')->assertOk()->assertInertia(fn (Assert $page) => $page->has('events.data', 1));
        $this->get('/dd-phase3/audit-logs?activity_from=2026-11-09&activity_to=2026-11-09')->assertOk()->assertInertia(fn (Assert $page) => $page->has('events.data', 0));
        $this->getJson('/dd-phase3/audit-logs?activity_action=TRUNCATE')->assertUnprocessable();
        $this->assertSame($before, DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson());
    }

    public function test_authentication_filters_safe_projection_and_append_only_proposal(): void
    {
        $this->ready();
        $this->postJson('/login', ['email' => 'unknown@example.test', 'password' => 'NEVER-EXPOSE'])->assertUnprocessable();
        $this->login($this->root);
        $this->get('/dd-phase3/audit-logs?auth_search=unknown@example.test&auth_event=FAILED_LOGIN')->assertOk()
            ->assertDontSee('NEVER-EXPOSE')->assertInertia(fn (Assert $page) => $page->has('authentication.data', 1)->missing('authentication.data.0.attempt_reference')->missing('authentication.data.0.session_reference')->where('authentication.data.0.user_account_id', null));
        foreach (['update', 'delete', 'truncate'] as $mutation) {
            try {
                $mutation === 'update' ? $this->events()->update(['outcome' => 'Successful']) : $this->events()->$mutation();
                $this->fail('History mutation allowed');
            } catch (QueryException $e) {
                $this->assertSame('42501', $e->getCode());
            }
        }
        $this->assertSame(2, $this->events()->count());
    }

    public function test_private_auxiliary_schema_requires_explicit_rls_and_cannot_grant_history_mutation(): void
    {
        $this->ready();
        DB::unprepared('CREATE ROLE jairoads_monitor_probe NOLOGIN; GRANT USAGE ON SCHEMA jairoads_security TO jairoads_monitor_probe;
            GRANT SELECT,INSERT ON jairoads_security.authentication_events TO jairoads_monitor_probe;
            GRANT USAGE ON SEQUENCE jairoads_security.authentication_events_id_seq TO jairoads_monitor_probe;');
        try {
            DB::statement('SET ROLE jairoads_monitor_probe');
            $this->assertSame(0, $this->events()->count());
            try {
                $this->events()->insert(['event' => 'FAILED_LOGIN', 'outcome' => 'Rejected', 'method' => 'password', 'client_description' => 'Unknown browser / Desktop']);
                $this->fail('Missing RLS policy must deny writes');
            } catch (QueryException $e) {
                $this->assertSame('42501', $e->getCode());
            }
            DB::statement('RESET ROLE');
            DB::unprepared('CREATE POLICY monitoring_probe_read ON jairoads_security.authentication_events FOR SELECT TO jairoads_monitor_probe USING (true);
                CREATE POLICY monitoring_probe_append ON jairoads_security.authentication_events FOR INSERT TO jairoads_monitor_probe WITH CHECK (true);');
            DB::statement('SET ROLE jairoads_monitor_probe');
            $this->events()->insert(['event' => 'FAILED_LOGIN', 'outcome' => 'Rejected', 'method' => 'password', 'client_description' => 'Unknown browser / Desktop']);
            $this->assertSame(1, $this->events()->count());
            foreach (['delete', 'truncate'] as $method) {
                try {
                    $this->events()->$method();
                    $this->fail('History removal must remain denied');
                } catch (QueryException $e) {
                    $this->assertSame('42501', $e->getCode());
                }
            }
        } finally {
            DB::statement('RESET ROLE');
            DB::unprepared('DROP POLICY IF EXISTS monitoring_probe_read ON jairoads_security.authentication_events;
                DROP POLICY IF EXISTS monitoring_probe_append ON jairoads_security.authentication_events;
                DROP OWNED BY jairoads_monitor_probe; DROP ROLE jairoads_monitor_probe;');
        }
    }

    public function test_authentication_pagination_is_independent_stable_and_timezone_correct(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->events()->insert(['event' => 'FAILED_LOGIN', 'outcome' => 'Rejected', 'method' => 'password',
                'attempted_identifier' => 'u***@e***', 'client_description' => 'Firefox / Desktop',
                'created_at' => '2026-11-10T00:00:00+00:00']);
        }
        $this->ready();
        $this->actingAs($this->root);
        $this->get('/dd-phase3/audit-logs?activity_action=DELETE&auth_from=2026-11-10&auth_to=2026-11-10')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('events.data', 0)->has('authentication.data', 25)
                ->where('authentication.total', 30)->where('authentication.data.0.id', 30)
                ->where('authentication.data.0.created_at', '2026-11-10T00:00:00+00:00'));
        $this->get('/dd-phase3/audit-logs?activity_action=DELETE&auth_page=2')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('authentication.data', 5)->where('authentication.data.0.id', 5));
        $this->get('/dd-phase3/audit-logs?auth_to=2026-11-09')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('authentication.data', 0));
    }

    public function test_revocation_during_history_reads_prevents_privileged_response(): void
    {
        $this->ready();
        $this->actingAs($this->root);
        $revoked = false;
        $id = $this->root->dd_user_account_id;
        DB::connection()->beforeExecuting(static function (string $query) use (&$revoked, $id): void {
            if (! $revoked && str_contains($query, '"authentication_events"')) {
                $revoked = true;
                DB::table('jairoads_next.user_accounts')->where('id', $id)->update(['is_active' => false]);
            }
        });
        $this->get('/dd-phase3/audit-logs')->assertForbidden();
        $this->assertTrue($revoked);
    }
}
