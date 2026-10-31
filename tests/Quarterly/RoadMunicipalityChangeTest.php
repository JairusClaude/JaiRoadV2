<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

final class RoadMunicipalityChangeTest extends PostgresTestCase
{
    public static function writers(): iterable
    {
        foreach (['Admin', 'SuperAdmin', 'Engineer', 'linked_admin'] as $role) {
            yield $role => [$role];
        }
    }

    #[DataProvider('writers')]
    public function test_review_then_confirmation_changes_only_municipality_and_appends_exactly_one_event(string $role): void
    {
        $f = $this->setupHistory($role);
        $before = $this->history();
        $road = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $preview = $this->preview($f)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('road.id', $f['road'])->assertJsonPath('previous.lgu_id', (int) $road->lgu_id)
            ->assertJsonPath('previous.municipality', 'Test municipality')->assertJsonPath('proposed.municipality', 'Destination town')
            ->assertJsonPath('projects.0.id', $f['project'])->assertJsonPath('projects.0.title', 'Test project')
            ->assertJsonPath('counts', ['maintenance_records' => 1, 'monthly_updates' => 1, 'documents' => 1, 'media' => 1])
            ->assertJsonPath('maintenance_record_ids.0', $f['record'])->assertJsonPath('managers.0.eligible', true)
            ->assertJsonPath('can_confirm', true)->json();
        $this->assertEquals($road, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $this->assertSame($before, $this->history()); // Review, followed by Cancel, has no write at all.
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
        $this->confirm($f, $preview['confirmation_token'])->assertRedirect('/dd-phase3/roads')
            ->assertSessionHas('dd_operations_status', 'Municipality changed from Test municipality to Destination town. Road geometry and maintenance history were preserved.');
        $after = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        foreach (['geojson', 'kilometers', 'road_name', 'pavement_type', 'state_category', 'created_by', 'created_at'] as $field) {
            $this->assertSame($road->$field, $after->$field, $field);
        }
        $this->assertSame($f['destination'], (int) $after->lgu_id);
        $this->assertSame($before, $this->history());
        $this->assertSame(1, DB::table('jairoads_next.road_coverages')->count());
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count());
        $event = DB::table('jairoads_next.audit_logs')->orderByDesc('id')->first();
        $this->assertSame((int) $f['user']->dd_user_account_id, (int) $event->user_id);
        $this->assertSame('DD-UserAccount#'.$f['user']->dd_user_account_id, $event->actor_identifier);
        $this->assertSame('UPDATE', $event->action);
        $this->assertSame('RoadCoverage', $event->entity_type);
        $this->assertSame($f['road'], (int) $event->entity_id);
        $this->assertNull($event->recipient_user_id);
        $this->assertNull($event->notification_message);
        $this->assertNotNull($event->created_at);
        $this->assertStringContainsString('Test municipality to Destination town', $event->description);
        $this->assertJsonStringEqualsJsonString(json_encode(['lgu_id' => (int) $road->lgu_id, 'municipality' => 'Test municipality', 'project_ids' => [$f['project']], 'maintenance_record_ids' => [$f['record']]]), $event->old_value);
        $this->assertJsonStringEqualsJsonString(json_encode(['lgu_id' => $f['destination'], 'municipality' => 'Destination town', 'project_ids' => [$f['project']], 'maintenance_record_ids' => [$f['record']]]), $event->new_value);
        $this->assertStringNotContainsString('private/', json_encode($preview));
        $this->assertStringNotContainsString('Historic administrative payload', json_encode($preview));
        $this->assertStringNotContainsString('password', $event->old_value.$event->new_value);
        $this->confirm($f, $preview['confirmation_token'])->assertUnprocessable(); // No replay or duplicate event.
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count());
    }

    public static function deniedActors(): iterable
    {
        foreach (['Viewer', 'missing_destination', 'inactive_destination', 'missing_source', 'inactive_account', 'retired', 'unlinked'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('deniedActors')]
    public function test_both_endpoints_reject_unauthorized_or_inactive_actors(string $case): void
    {
        $f = $this->setupHistory('Engineer');
        $token = $this->preview($f)->assertOk()->json('confirmation_token');
        match ($case) {
            'Viewer' => $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer')),
            'missing_destination' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $f['destination'])->delete(),
            'inactive_destination' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $f['destination'])->update(['is_active' => false]),
            'missing_source' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', '!=', $f['destination'])->delete(),
            'inactive_account' => DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]),
            'retired' => DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['engineer_status' => 'Retired']),
            'unlinked' => $this->withSession(['password_hash_web' => null])->actingAs($this->account('Engineer')),
        };
        $before = $this->history();
        $this->preview($f)->assertForbidden();
        $this->confirm($f, $token)->assertForbidden();
        $this->assertSame($before, $this->history());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public static function invalidManagers(): iterable
    {
        foreach (['retired', 'inactive_account', 'missing_account', 'viewer_account', 'missing_destination', 'inactive_destination'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('invalidManagers')]
    public function test_each_existing_manager_must_remain_eligible_and_conflicts_block_confirmation(string $case): void
    {
        $f = $this->setupHistory();
        match ($case) {
            'retired' => DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['engineer_status' => 'Retired']),
            'inactive_account' => DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])->update(['is_active' => false]),
            'missing_account' => DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])->update(['engineer_id' => null]),
            'viewer_account' => DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])->update(['account_type' => 'Viewer']),
            'missing_destination' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $f['destination'])->delete(),
            'inactive_destination' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $f['destination'])->update(['is_active' => false]),
        };
        $before = $this->history();
        $road = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $review = $this->preview($f)->assertOk()->assertJsonPath('can_confirm', false)->assertJsonPath('managers.0.eligible', false)->json();
        $this->assertStringContainsString('MaintenanceRecord #'.$f['record'], $review['conflicts'][0]);
        $this->confirm($f, $review['confirmation_token'])->assertUnprocessable()->assertJsonValidationErrors('confirmation_token');
        $this->assertEquals($road, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $this->assertSame($before, $this->history());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public static function staleChanges(): iterable
    {
        foreach (['road_name', 'source_municipality', 'geometry', 'updated_at', 'project_title', 'project_unlinked', 'record_inserted', 'manager_reassigned', 'record_deleted', 'monthly_inserted', 'monthly_updated', 'document_inserted', 'media_inserted', 'assignment_changed', 'account_changed', 'manager_renamed', 'municipality_renamed'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('staleChanges')]
    public function test_current_relationship_or_authorization_changes_invalidate_the_review(string $case): void
    {
        $f = $this->setupHistory();
        $token = $this->preview($f)->assertOk()->json('confirmation_token');
        switch ($case) {
            case 'road_name':
                DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['road_name' => 'Changed elsewhere']);
                break;
            case 'source_municipality':
                DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['lgu_id' => $this->destination()]);
                break;
            case 'geometry':
                DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['geojson' => '{"type":"LineString","coordinates":[[120,10],[121,11]]}']);
                break;
            case 'updated_at':
                DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['updated_at' => '2020-01-01']);
                break;
            case 'project_title':
                DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->update(['project_title' => 'New title']);
                break;
            case 'project_unlinked':
                DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->update(['road_coverage_id' => $this->road()]);
                break;
            case 'record_inserted':
                DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->dd_user_account_id]);
                break;
            case 'manager_reassigned':
                DB::table('jairoads_next.maintenance_records')->where('id', $f['record'])->update(['managing_engineer_id' => $this->engineer()]);
                break;
            case 'record_deleted':
                DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->dd_user_account_id]);
                $token = $this->preview($f)->assertOk()->json('confirmation_token');
                DB::table('jairoads_next.maintenance_records')->where('quarter', 'Q2')->delete();
                break;
            case 'monthly_inserted':
                DB::table('jairoads_next.monthly_updates')->insert(['maintenance_id' => $f['record'], 'update_month' => '2026-02', 'progress_percentage' => 30, 'created_by' => $f['user']->dd_user_account_id]);
                break;
            case 'monthly_updated':
                DB::table('jairoads_next.monthly_updates')->where('id', $f['update'])->update(['updated_at' => '2020-01-01']);
                break;
            case 'document_inserted':
                DB::table('jairoads_next.maintenance_documents')->insert(['maintenance_id' => $f['record'], 'document_title' => 'New', 'file_name' => 'new.pdf', 'file_path' => 'private/new.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
                break;
            case 'media_inserted':
                DB::table('jairoads_next.media')->insert(['monthly_update_id' => $f['update'], 'file_name' => 'new.png', 'file_path' => 'private/new.png', 'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id]);
                break;
            case 'assignment_changed':
                DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $f['destination'])->update(['is_active' => false]);
                break;
            case 'account_changed':
                DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])->update(['is_active' => false]);
                break;
            case 'manager_renamed':
                DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['first_name' => 'Changed']);
                break;
            case 'municipality_renamed':
                DB::table('jairoads_next.lgus')->where('id', $f['destination'])->update(['municipality_name' => 'Changed name']);
        }
        $before = $this->history();
        $road = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $this->confirm($f, $token)->assertUnprocessable()->assertJsonValidationErrors('confirmation_token');
        $this->assertEquals($road, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $this->assertSame($before, $this->history());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_audit_failure_rolls_back_the_transition_and_retry_can_commit_one_event(): void
    {
        $f = $this->setupHistory();
        $token = $this->preview($f)->assertOk()->json('confirmation_token');
        $road = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $history = $this->history();
        $fail = true;
        DB::connection()->beforeExecuting(static function (string $sql) use (&$fail): void {
            if ($fail && str_starts_with($sql, 'insert into "jairoads_next"."audit_logs"')) {
                throw new \RuntimeException('Disposable audit failure');
            }
        });
        $this->confirm($f, $token)->assertServerError();
        $this->assertEquals($road, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $this->assertSame($history, $this->history());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
        $fail = false;
        $this->confirm($f, $token)->assertRedirect();
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_invalid_expired_cross_actor_cross_road_and_tampered_tokens_cannot_confirm(): void
    {
        $f = $this->setupHistory();
        $token = $this->preview($f)->assertOk()->json('confirmation_token');
        $this->postJson($this->url($f, 'confirm'), [])->assertUnprocessable();
        $this->confirm($f, 'tampered')->assertUnprocessable();
        $this->confirm($f, $token.'tampered')->assertUnprocessable();
        $otherRoad = $this->road();
        $this->postJson('/dd-phase3/ops/roads/'.$otherRoad.'/municipality/confirm', ['confirmation_token' => $token])->assertUnprocessable();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->confirm($f, $token)->assertUnprocessable();
        $this->withSession(['password_hash_web' => null])->actingAs($f['user']);
        $claim = json_decode(Crypt::decryptString($token), true);
        $claim['destination'] = $otherRoad; // Re-encrypt only inside a trusted test to exercise a bad claim shape.
        $claim['fingerprint'] = [];
        $this->confirm($f, Crypt::encryptString(json_encode($claim)))->assertUnprocessable();
        $this->travel(16)->minutes();
        $this->confirm($f, $token)->assertUnprocessable()->assertJsonValidationErrors('confirmation_token');
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_unlinked_road_and_project_without_history_can_be_reviewed_and_changed(): void
    {
        $f = $this->fixture();
        $f['destination'] = $this->destination();
        $review = $this->preview($f)->assertOk()->assertJsonCount(1, 'projects')->assertJsonPath('counts.maintenance_records', 0)->json();
        $this->confirm($f, $review['confirmation_token'])->assertRedirect();
        $road = $this->road();
        $f['road'] = $road;
        $review = $this->preview($f)->assertOk()->assertJsonPath('projects', [])->assertJsonPath('managers', [])->assertJsonPath('can_confirm', true)->json();
        $this->confirm($f, $review['confirmation_token'])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $road, 'lgu_id' => $f['destination']]);
    }

    public function test_ordinary_save_cannot_bypass_review_or_change_geometry_with_a_municipality_transition(): void
    {
        $f = $this->setupHistory();
        $road = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $data = ['road_name' => 'Must not save', 'lgu_id' => $f['destination'], 'kilometers' => 55,
            'pavement_type' => 'Gravel', 'state_category' => 'Bad', 'geojson' => '{"type":"LineString","coordinates":[[122,12],[123,13]]}'];
        $this->putJson('/dd-phase3/ops/roads/'.$f['road'], $data)->assertUnprocessable()->assertJsonValidationErrors('lgu_id');
        $this->assertEquals($road, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $token = $this->preview($f)->assertOk()->json('confirmation_token');
        $this->postJson($this->url($f, 'confirm'), $data + ['confirmation_token' => $token])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $f['road'], 'road_name' => $road->road_name, 'kilometers' => $road->kilometers, 'lgu_id' => $f['destination']]);
        $this->assertSame($road->geojson, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('geojson'));
    }

    public function test_missing_same_and_invalid_destination_or_missing_road_never_writes_an_event(): void
    {
        $f = $this->setupHistory();
        $this->postJson($this->url($f, 'preview'), [])->assertUnprocessable();
        $source = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $this->postJson($this->url($f, 'preview'), ['lgu_id' => $source])->assertUnprocessable();
        $this->postJson($this->url($f, 'preview'), ['lgu_id' => 999999])->assertUnprocessable();
        $this->postJson('/dd-phase3/ops/roads/999999/municipality/preview', ['lgu_id' => $f['destination']])->assertNotFound();
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_explicit_reassignment_resolves_conflict_only_after_a_refreshed_review(): void
    {
        $f = $this->setupHistory();
        DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $f['destination'])->update(['is_active' => false]);
        $token = $this->preview($f)->assertOk()->assertJsonPath('can_confirm', false)->json('confirmation_token');
        $replacement = $this->engineer();
        $this->account('Engineer', $replacement);
        $source = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        foreach ([$source, $f['destination']] as $lgu) {
            DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => true]);
        }
        $this->postJson('/dd-phase3/ops/records/'.$f['record'].'/reassignment', ['managing_engineer_id' => $replacement, 'expected_current_manager_id' => $f['engineer']])->assertRedirect();
        $this->confirm($f, $token)->assertUnprocessable();
        $fresh = $this->preview($f)->assertOk()->assertJsonPath('can_confirm', true)->assertJsonPath('managers.0.engineer_id', $replacement)->json('confirmation_token');
        $before = $this->history();
        $this->confirm($f, $fresh)->assertRedirect();
        $this->assertSame($before, $this->history());
    }

    public function test_every_historical_manager_is_checked_even_when_another_record_is_eligible(): void
    {
        $f = $this->setupHistory();
        $other = $this->engineer();
        $this->account('Engineer', $other);
        $second = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(array_replace($this->recordData($f['project'], $other, 'Q2'), [
            'status' => 'Completed', 'complete_date' => '2026-04-06', 'created_by' => $f['user']->dd_user_account_id,
        ]));
        $review = $this->preview($f)->assertOk()->assertJsonPath('counts.maintenance_records', 2)
            ->assertJsonPath('managers.0.eligible', true)->assertJsonPath('managers.1.eligible', false)->assertJsonPath('can_confirm', false)->json();
        $this->assertStringContainsString('MaintenanceRecord #'.$second, $review['conflicts'][0]);
        $this->confirm($f, $review['confirmation_token'])->assertUnprocessable();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $second, 'status' => 'Completed', 'managing_engineer_id' => $other]);
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_two_concurrent_http_confirmations_commit_exactly_one_transition(): void
    {
        $f = $this->setupHistory();
        $token = $this->preview($f)->assertOk()->json('confirmation_token');
        DB::commit(); // Only the guarded disposable fixture becomes visible to workers.
        $processes = [];
        try {
            DB::beginTransaction();
            DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->lockForUpdate()->first();
            for ($i = 0; $i < 2; $i++) {
                $process = new Process([PHP_BINARY, __DIR__.'/concurrent-municipality-request.php', (string) $f['user']->id, (string) $f['road'], $token]);
                $process->setTimeout(15);
                $process->start();
                $processes[] = $process;
            }
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'municipality_concurrency_worker' AND wait_event_type = 'Lock'")->n;
                if ($waiting === 2) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertSame(2, $waiting, 'Both HTTP workers must actually contend on the RoadCoverage lock.');
            DB::commit();
            $statuses = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
                $statuses[] = json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR)['status'];
            }
            sort($statuses);
            $this->assertSame([302, 422], $statuses);
            $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count()); // Historical CREATE + one UPDATE.
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('action', 'UPDATE')->count());
            $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $f['road'], 'lgu_id' => $f['destination']]);
        } finally {
            foreach ($processes as $process) {
                $process->stop();
            }
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::unprepared('TRUNCATE public.users, jairoads_next.user_accounts, jairoads_next.engineers, jairoads_next.lgus CASCADE');
        }
    }

    private function setupHistory(string $role = 'Admin'): array
    {
        $f = $this->fixture($role === 'linked_admin' ? 'Admin' : $role, $role === 'linked_admin');
        $f['destination'] = $this->destination();
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $f['engineer'], 'lgu_id' => $f['destination'], 'is_active' => true]);
        $f['record'] = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $f['update'] = (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $f['record'], 'update_month' => '2026-01', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.maintenance_documents')->insert(['maintenance_id' => $f['record'], 'document_title' => 'Historic document', 'file_name' => 'retained.pdf', 'file_path' => 'private/retained.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.media')->insert(['monthly_update_id' => $f['update'], 'file_name' => 'retained.png', 'file_path' => 'private/retained.png', 'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $f['historic_audit'] = (int) DB::table('jairoads_next.audit_logs')->insertGetId(['user_id' => $f['user']->dd_user_account_id, 'actor_identifier' => 'Historical actor', 'action' => 'CREATE', 'entity_type' => 'RoadCoverage', 'entity_id' => $f['road'], 'description' => 'Historic administrative payload', 'old_value' => null, 'new_value' => '{"municipality":"Historical municipality"}']);

        return $f;
    }

    private function destination(): int
    {
        return (int) DB::table('jairoads_next.lgus')->insertGetId(['municipality_name' => 'Destination town', 'province' => 'Test province', 'region' => 'Test region', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor']);
    }

    private function url(array $f, string $stage): string
    {
        return '/dd-phase3/ops/roads/'.$f['road'].'/municipality/'.$stage;
    }

    private function preview(array $f): TestResponse
    {
        return $this->postJson($this->url($f, 'preview'), ['lgu_id' => $f['destination']]);
    }

    private function confirm(array $f, string $token): TestResponse
    {
        return $this->postJson($this->url($f, 'confirm'), ['confirmation_token' => $token]);
    }

    private function history(): array
    {
        $result = [];
        foreach (['maintenance_projects', 'maintenance_records', 'monthly_updates', 'maintenance_documents', 'media'] as $table) {
            $result[$table] = DB::table('jairoads_next.'.$table)->orderBy('id')->get()->toJson();
        }
        $result['old_audit'] = DB::table('jairoads_next.audit_logs')->where('description', 'Historic administrative payload')->get()->toJson();

        return $result;
    }
}
