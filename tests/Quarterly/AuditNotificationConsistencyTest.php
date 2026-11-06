<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdActivityNotifications;
use App\Services\DataDictionary\DdAuditValues;
use App\Services\DataDictionary\DdOperationAudit;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

final class AuditNotificationConsistencyTest extends PostgresTestCase
{
    private const DELIVERIES = DdActivityNotifications::TABLE;

    public static function actors(): iterable
    {
        yield ['Admin'];
        yield ['SuperAdmin'];
        yield ['Engineer'];
    }

    #[DataProvider('actors')]
    public function test_one_event_notifies_every_eligible_administrator_and_engineer_actor_once(string $role): void
    {
        $f = $this->fixture($role);
        $admins = [$this->account('Admin'), $this->account('Admin'), $this->account('SuperAdmin')];
        $viewer = $this->account('Viewer');
        $unrelated = $this->account('Engineer');
        $inactive = $this->account('Admin', active: false);
        $retired = $this->account('Admin', $this->engineer('Retired'));
        $unlinked = $this->account('Admin', linked: false);
        $badEvidence = $this->account('Admin');
        DB::table('jairoads_next.user_accounts')->where('id', $badEvidence->dd_user_account_id)->update(['engineer_id' => $this->engineer()]);
        $badHash = $this->account('SuperAdmin');
        DB::table('public.users')->where('id', $badHash->id)->update(['password' => 'Invalid matching credential state']);
        $this->post('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertRedirect();
        $event = DB::table('jairoads_next.audit_logs')->sole();
        $this->assertSame('CREATE', $event->action);
        $this->assertNull($event->old_value);
        $this->assertSame($f['project'], json_decode($event->new_value, true)['project_id']);
        $this->assertNull($event->recipient_user_id);
        $this->assertNull($event->notification_message);
        $actual = DB::table(self::DELIVERIES)->where('audit_log_id', $event->id)->pluck('recipient_user_id')->all();
        $this->assertContains($f['user']->dd_user_account_id, $actual);
        foreach ($admins as $admin) {
            $this->assertContains($admin->dd_user_account_id, $actual);
        }
        foreach ([$viewer, $unrelated, $inactive, $retired, $unlinked, $badEvidence, $badHash] as $denied) {
            $this->assertNotContains($denied->dd_user_account_id, $actual);
        }
        $eligible = app(DataDictionaryIdentityResolver::class)->notificationRecipients($role === 'Engineer' ? $f['user']->dd_user_account_id : null)->count();
        $this->assertCount($eligible, $actual);
        $this->assertSame(count($actual), count(array_unique($actual)));
    }

    public function test_unchanged_normalized_saves_do_not_write_events_deliveries_or_timestamps(): void
    {
        $f = $this->fixture();
        $data = $this->recordData($f['project'], $f['engineer']);
        $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($data + ['created_by' => $f['user']->dd_user_account_id]);
        $month = ['maintenance_id' => $id, 'update_month' => '2027-12', 'progress_percentage' => '12.30', 'summary_of_text_reports' => null];
        $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId($month + ['created_by' => $f['user']->dd_user_account_id]);
        $persisted = DB::table('jairoads_next.monthly_updates')->where('id', $update)->first();
        $this->put('/dd-phase3/ops/records/'.$id, $data)->assertRedirect();
        $this->put('/dd-phase3/ops/updates/'.$update, array_replace($month, ['progress_percentage' => '12.300']))->assertRedirect();
        $this->put('/dd-phase3/ops/projects/'.$f['project'], ['project_title' => 'Test project', 'road_coverage_id' => $f['road'], 'description' => ''])->assertRedirect();
        $lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $this->post('/dd-phase3/assignments', ['engineer_id' => $f['engineer'], 'lgu_id' => $lgu, 'is_active' => '1'])->assertRedirect();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
        $this->assertEquals($persisted, DB::table('jairoads_next.monthly_updates')->where('id', $update)->first());
    }

    public function test_update_delete_and_actor_snapshots_are_accurate_and_permanent(): void
    {
        $f = $this->fixture();
        $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $month = ['maintenance_id' => $id, 'update_month' => '2027-12', 'progress_percentage' => '10', 'summary_of_text_reports' => 'Old report'];
        $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId($month + ['created_by' => $f['user']->dd_user_account_id]);
        $this->put('/dd-phase3/ops/updates/'.$update, array_replace($month, ['progress_percentage' => '15', 'summary_of_text_reports' => 'New report']))->assertRedirect();
        $event = DB::table('jairoads_next.audit_logs')->sole();
        $this->assertSame(['progress_percentage' => '10.00', 'summary_of_text_reports' => 'Old report'], json_decode($event->old_value, true));
        $this->assertSame(['progress_percentage' => '15.00', 'summary_of_text_reports' => 'New report'], json_decode($event->new_value, true));
        $historical = json_encode($event);
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['username' => 'renamed-account']);
        $this->delete('/dd-phase3/ops/updates/'.$update)->assertRedirect();
        $deleted = DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->sole();
        $this->assertSame('15.00', json_decode($deleted->old_value, true)['progress_percentage']);
        $this->assertNull($deleted->new_value);
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $this->assertSame($historical, json_encode(DB::table('jairoads_next.audit_logs')->where('id', $event->id)->first()));
        $this->assertNotSame($event->actor_identifier, $deleted->actor_identifier);
    }

    public function test_delivery_failure_rolls_back_the_mutation_and_event(): void
    {
        $f = $this->fixture();
        DB::unprepared("CREATE FUNCTION jairoads_next.fail_delivery_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Disposable recipient failure'; END $$; CREATE TRIGGER fail_delivery_test BEFORE INSERT ON ".self::DELIVERIES.' FOR EACH ROW EXECUTE FUNCTION jairoads_next.fail_delivery_test()');
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertServerError();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
    }

    public function test_retry_rolls_back_intermediate_event_and_deliveries(): void
    {
        $f = $this->fixture();
        $actor = app(DataDictionaryIdentityResolver::class)->resolve($f['user']);
        DB::commit(); // Exercise Laravel's real top-level transaction retry, not a nested savepoint.
        try {
            $attempts = 0;
            DB::transaction(function () use ($f, $actor, &$attempts): void {
                $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $actor['account_id']]);
                app(DdOperationAudit::class)->record($actor, 'CREATE', 'MaintenanceRecord', $id, 'Synthetic retry test.');
                if (++$attempts === 1) {
                    throw new \PDOException('deadlock detected', 40001);
                }
            }, 2);
            $this->assertSame(2, $attempts);
            $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
            $this->assertSame(2, DB::table(self::DELIVERIES)->count());
        } finally {
            PostgresTestSchema::clearCommittedFixtures();
        }
    }

    public function test_allowlists_exclude_credentials_paths_and_arbitrary_fields(): void
    {
        $f = $this->fixture();
        $actor = app(DataDictionaryIdentityResolver::class)->resolve($f['user']);
        $secrets = ['password' => 'HASH-SECRET', 'two_factor_secret' => 'MFA-SECRET', 'token' => 'RESET-SECRET', 'file_path' => 'PRIVATE-PATH', 'credential' => 'PASSKEY-SECRET', 'email' => 'private@example.test'];
        $old = DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->value('username');
        DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->update(['username' => 'after']);
        app(DdOperationAudit::class)->record($actor, 'UPDATE', 'UserAccount', $actor['account_id'], 'Safe account change.', ['username' => 'after'] + $secrets, ['username' => $old] + $secrets);
        $event = DB::table('jairoads_next.audit_logs')->sole();
        $this->assertSame(['username' => $old], json_decode($event->old_value, true));
        $this->assertSame(['username' => 'after'], json_decode($event->new_value, true));
        foreach ($secrets as $secret) {
            $this->assertStringNotContainsString($secret, json_encode($event));
        }
        $safe = app(DdAuditValues::class)->safe('Media', ['file_name' => '/private/path/name.png', 'file_path' => 'secret']);
        $this->assertSame(['file_name' => 'name.png'], $safe);
    }

    public function test_history_and_deliveries_reject_mutation_and_duplicate_delivery(): void
    {
        $f = $this->fixture();
        $this->post('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertRedirect();
        foreach (['jairoads_next.audit_logs', self::DELIVERIES] as $table) {
            foreach (['UPDATE '.$table.' SET created_at = CURRENT_TIMESTAMP', 'DELETE FROM '.$table, 'TRUNCATE '.$table.' CASCADE'] as $sql) {
                try {
                    DB::transaction(fn () => DB::statement($sql));
                    $this->fail('History mutation allowed.');
                } catch (QueryException $e) {
                    $this->assertSame('42501', $e->errorInfo[0]);
                }
            }
        }
        $delivery = DB::table(self::DELIVERIES)->first();
        try {
            DB::transaction(fn () => DB::table(self::DELIVERIES)->insert(['audit_log_id' => $delivery->audit_log_id, 'recipient_user_id' => $delivery->recipient_user_id, 'notification_message' => 'Duplicate']));
            $this->fail('Duplicate delivery allowed.');
        } catch (QueryException $e) {
            $this->assertSame('23505', $e->errorInfo[0]);
        }
    }

    public static function readers(): iterable
    {
        foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
            yield [$role];
        }
    }

    #[DataProvider('readers')]
    public function test_safe_feed_compatibility_and_privileged_history_authorization(string $role): void
    {
        $f = $this->fixture($role);
        $other = $this->account('Admin');
        $id = (int) DB::table('jairoads_next.audit_logs')->insertGetId(['user_id' => $other->dd_user_account_id, 'actor_identifier' => 'Historic actor', 'action' => 'LOGIN', 'entity_type' => 'UserAccount', 'entity_id' => $other->dd_user_account_id, 'description' => 'Historical sign-in', 'recipient_user_id' => $f['user']->dd_user_account_id, 'notification_message' => 'Legacy addressed message', 'old_value' => '{"password":"NEVER-RETURN","username":"historic"}']);
        DB::table(self::DELIVERIES)->insert(['audit_log_id' => $id, 'recipient_user_id' => $f['user']->dd_user_account_id, 'notification_message' => 'Current addressed message']);
        DB::table(self::DELIVERIES)->insert(['audit_log_id' => $id, 'recipient_user_id' => $other->dd_user_account_id, 'notification_message' => 'Someone else']);
        $history = DB::table('jairoads_next.audit_logs')->get()->toJson();
        $this->getJson('/jairoads/notifications?recipient_user_id='.$other->dd_user_account_id)->assertOk()->assertExactJson(['notifications' => [['id' => $id, 'notification_message' => 'Current addressed message', 'created_at' => DB::table(self::DELIVERIES)->value('created_at')]]]);
        $response = $this->get('/dd-phase3/audit-logs');
        if (in_array($role, ['Admin', 'SuperAdmin'], true)) {
            $response->assertOk()->assertDontSee('NEVER-RETURN');
        } else {
            $response->assertForbidden();
        }
        $this->put('/dd-phase3/audit-logs/'.$id, [])->assertNotFound();
        $this->delete('/dd-phase3/audit-logs/'.$id)->assertNotFound();
        $this->assertSame($history, DB::table('jairoads_next.audit_logs')->get()->toJson());
    }

    public function test_password_login_and_logout_write_no_business_events_or_deliveries(): void
    {
        $user = $this->account('Engineer');
        $this->post('/login', ['email' => $user->email, 'password' => 'Disposable-Test!123'])->assertRedirect();
        $this->assertAuthenticated();
        $this->post('/logout')->assertRedirect();
        $this->assertGuest();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
    }

    public function test_missing_schema_blocks_mutation_without_losing_legacy_feed(): void
    {
        $f = $this->fixture();
        DB::statement('DROP TABLE '.self::DELIVERIES);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertStatus(503);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->getJson('/jairoads/notifications')->assertOk()->assertExactJson(['notifications' => []]);
    }
}
