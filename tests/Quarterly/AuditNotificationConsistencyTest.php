<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\ActivityNotifications;
use App\Services\AuditValues;
use App\Services\OperationAudit;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

final class AuditNotificationConsistencyTest extends PostgresTestCase
{
    private const DELIVERIES = ActivityNotifications::TABLE;

    public static function actors(): iterable
    {
        yield ['Admin'];
        yield ['SuperAdmin'];
        yield ['Engineer'];
    }

    #[DataProvider('actors')]
    public function test_one_event_addresses_only_the_eligible_assignee_without_admin_broadcast(string $role): void
    {
        $f = $this->fixture($role);
        $this->account('Admin');
        $this->account('SuperAdmin');
        $this->account('Viewer');
        $this->post('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertRedirect();

        $event = DB::table('jairoads_next.audit_logs')->sole();
        $this->assertSame('CREATE', $event->action);
        $this->assertNull($event->old_value);
        $this->assertSame($f['project'], json_decode($event->new_value, true)['project_id']);
        $recipient = DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])
            ->where('account_type', 'Engineer')->value('id');
        $expected = $role === 'Engineer' ? null : (int) $recipient;
        $this->assertSame($expected, $event->recipient_user_id === null ? null : (int) $event->recipient_user_id);
        if ($expected === null) {
            $this->assertNull($event->notification_message);
        } else {
            $this->assertSame($role.' created MaintenanceRecord #'.$event->entity_id.'.', $event->notification_message);
        }
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
        $this->getJson('/jairoads/notifications')->assertOk()->assertExactJson(['notifications' => []]);
        if ($expected !== null) {
            $engineer = User::where('dd_user_account_id', $expected)->firstOrFail();
            $this->actingAs($engineer)->getJson('/jairoads/notifications')->assertOk()
                ->assertJsonPath('notifications.0.id', (int) $event->id);
        }
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

    public function test_road_lgu_document_and_account_unchanged_saves_preserve_exact_data(): void
    {
        $f = $this->fixture();
        $road = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $this->put('/dd-phase3/ops/roads/'.$f['road'], ['road_name' => $road->road_name, 'lgu_id' => (string) $road->lgu_id,
            'kilometers' => '1.000', 'pavement_type' => $road->pavement_type, 'state_category' => $road->state_category,
            'geojson' => '{"coordinates":[[123.0,10.0],[123.1,10.1]],"type":"LineString"}'])->assertRedirect();
        $this->assertEquals($road, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $lgu = (array) DB::table('jairoads_next.lgus')->where('id', $road->lgu_id)->first();
        $this->put('/dd-phase3/lgus/'.$road->lgu_id, $lgu)->assertRedirect();
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $document = (int) DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $record, 'document_title' => 'Same title', 'file_name' => 'same.pdf', 'file_path' => 'private-never-audited', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $this->put('/dd-phase3/ops/documents/'.$document, ['document_title' => 'Same title', 'description' => ''])->assertRedirect();
        $username = DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->value('username');
        $this->put('/dd-phase3/ops/settings', ['username' => $username, 'current_password' => 'Disposable-Test!123'])->assertRedirect();
        $this->patch('/dd-phase3/accounts/'.$f['user']->dd_user_account_id.'/status', ['is_active' => '1'])->assertRedirect();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
    }

    public function test_structured_normalization_preserves_coordinate_order_dimensions_and_real_changes(): void
    {
        $values = app(AuditValues::class);
        $this->assertSame(64, strlen($values->safe('RoadCoverage', ['geojson' => 'Malformed historical geometry'])['geometry_sha256']));
        $a = '{"type":"LineString","coordinates":[[125.0,7],[126,8]],"properties":{"x":1,"y":2}}';
        $b = '{"properties":{"y":2,"x":1},"coordinates":[[125,7],[126,8]],"type":"LineString"}';
        $this->assertSame($values->geometryDigest($a), $values->geometryDigest($b));
        foreach (['{"type":"LineString","coordinates":[[126,8],[125,7]],"properties":{"x":1,"y":2}}',
            '{"type":"LineString","coordinates":[[125,7,1],[126,8,2]],"properties":{"x":1,"y":2}}',
            '{"type":"LineString","coordinates":[[125,7],[126,8]],"properties":{"x":"1","y":2}}'] as $changed) {
            $this->assertNotSame($values->geometryDigest($a), $values->geometryDigest($changed));
        }
    }

    public function test_audit_insert_failure_rolls_back_the_mutation_and_notification(): void
    {
        $f = $this->fixture();
        DB::unprepared("CREATE FUNCTION jairoads_next.fail_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Disposable audit failure'; END $$; CREATE TRIGGER fail_audit_test BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.fail_audit_test()");
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertServerError();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
    }

    public function test_retry_rolls_back_intermediate_event_and_deliveries(): void
    {
        $f = $this->fixture();
        $actor = app(AccountIdentityResolver::class)->resolve($f['user']);
        DB::commit(); // Exercise Laravel's real top-level transaction retry, not a nested savepoint.
        try {
            $attempts = 0;
            DB::transaction(function () use ($f, $actor, &$attempts): void {
                $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $actor['account_id']]);
                app(OperationAudit::class)->record($actor, 'CREATE', 'MaintenanceRecord', $id, 'Synthetic retry test.');
                if (++$attempts === 1) {
                    throw new \PDOException('deadlock detected', 40001);
                }
            }, 2);
            $this->assertSame(2, $attempts);
            $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
            $this->assertSame(0, DB::table(self::DELIVERIES)->count());
            $event = DB::table('jairoads_next.audit_logs')->sole();
            $this->assertNotNull($event->recipient_user_id);
            $this->assertNotNull($event->notification_message);
        } finally {
            PostgresTestSchema::clearCommittedFixtures();
        }
    }

    public function test_allowlists_exclude_credentials_paths_and_arbitrary_fields(): void
    {
        $f = $this->fixture();
        $actor = app(AccountIdentityResolver::class)->resolve($f['user']);
        $secrets = ['password' => 'HASH-SECRET', 'two_factor_secret' => 'MFA-SECRET', 'token' => 'RESET-SECRET', 'file_path' => 'PRIVATE-PATH', 'credential' => 'PASSKEY-SECRET', 'email' => 'private@example.test'];
        $old = DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->value('username');
        DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->update(['username' => 'after']);
        app(OperationAudit::class)->record($actor, 'UPDATE', 'UserAccount', $actor['account_id'], 'Safe account change.', ['username' => 'after'] + $secrets, ['username' => $old] + $secrets);
        $event = DB::table('jairoads_next.audit_logs')->sole();
        $this->assertSame(['username' => $old], json_decode($event->old_value, true));
        $this->assertSame(['username' => 'after'], json_decode($event->new_value, true));
        foreach ($secrets as $secret) {
            $this->assertStringNotContainsString($secret, json_encode($event));
        }
        $safe = app(AuditValues::class)->safe('Media', ['file_name' => '/private/path/name.png', 'file_path' => 'secret']);
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
        // Old auxiliary delivery rows remain immutable but new events never fan out.
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
        $event = DB::table('jairoads_next.audit_logs')->sole();
        $other = $this->account('Viewer');
        DB::table(self::DELIVERIES)->insert(['audit_log_id' => $event->id,
            'recipient_user_id' => $other->dd_user_account_id,
            'notification_message' => 'Legacy addressed delivery']);
        $delivery = DB::table(self::DELIVERIES)->sole();
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

    public function test_missing_legacy_delivery_table_does_not_block_canonical_audit(): void
    {
        $f = $this->fixture();
        DB::statement('DROP TABLE '.self::DELIVERIES);
        $this->post('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertRedirect();
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
        $this->getJson('/jairoads/notifications')->assertOk()->assertExactJson(['notifications' => []]);
    }

    public function test_unauthorized_invalid_fk_failure_and_late_rollback_create_no_success_deliveries(): void
    {
        $f = $this->fixture();
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', array_replace($data, ['start_date' => '2027-01-01']))->assertUnprocessable();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'))->postJson('/dd-phase3/ops/records', $data)->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($f['user']);
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($data + ['created_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.monthly_updates')->insert(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
        $this->deleteJson('/dd-phase3/ops/records/'.$record)->assertUnprocessable();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $record]);
        $actor = app(AccountIdentityResolver::class)->resolve($f['user']);
        try {
            DB::transaction(function () use ($actor, $record): void {
                DB::table('jairoads_next.maintenance_records')->where('id', $record)->update(['description' => 'Must roll back']);
                app(OperationAudit::class)->record($actor, 'UPDATE', 'MaintenanceRecord', $record, 'Late transaction test.', ['description' => 'Must roll back'], ['description' => null]);
                throw new \RuntimeException('Disposable late failure');
            });
            $this->fail('Late failure was swallowed.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Disposable late failure', $e->getMessage());
        }
        $this->assertNull(DB::table('jairoads_next.maintenance_records')->where('id', $record)->value('description'));
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(0, DB::table(self::DELIVERIES)->count());
    }

    public function test_auxiliary_table_requires_explicit_privileges_and_rls_policy(): void
    {
        $f = $this->fixture();
        $this->post('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertRedirect();
        $eventId = DB::table('jairoads_next.audit_logs')->value('id');
        $other = $this->account('Viewer');
        DB::table(self::DELIVERIES)->insert([
            ['audit_log_id' => $eventId, 'recipient_user_id' => $f['user']->dd_user_account_id,
                'notification_message' => 'Historical first recipient'],
            ['audit_log_id' => $eventId, 'recipient_user_id' => $other->dd_user_account_id,
                'notification_message' => 'Historical second recipient'],
        ]);
        DB::statement('CREATE ROLE jairoads_delivery_rehearsal NOLOGIN');
        DB::statement('GRANT USAGE ON SCHEMA jairoads_next TO jairoads_delivery_rehearsal');
        try {
            DB::transaction(function (): void {
                DB::statement('SET LOCAL ROLE jairoads_delivery_rehearsal');
                DB::table(self::DELIVERIES)->count();
            });
            $this->fail('Unprivileged SQL access allowed.');
        } catch (QueryException $e) {
            $this->assertSame('42501', $e->errorInfo[0]);
        }
        DB::statement('GRANT SELECT ON '.self::DELIVERIES.' TO jairoads_delivery_rehearsal');
        DB::transaction(function (): void {
            DB::statement('SET LOCAL ROLE jairoads_delivery_rehearsal');
            $this->assertSame(0, DB::table(self::DELIVERIES)->count()); // Grant alone does not bypass RLS.
            DB::statement('RESET ROLE');
        });
        DB::statement('CREATE POLICY delivery_rehearsal_read ON '.self::DELIVERIES.' FOR SELECT TO jairoads_delivery_rehearsal USING (true)');
        DB::transaction(function (): void {
            DB::statement('SET LOCAL ROLE jairoads_delivery_rehearsal');
            $this->assertSame(2, DB::table(self::DELIVERIES)->count());
            DB::statement('RESET ROLE');
        });
    }
}
