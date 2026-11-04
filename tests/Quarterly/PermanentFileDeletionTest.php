<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Files\PermanentFileDeletion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

final class PermanentFileDeletionTest extends PostgresTestCase
{
    private array $bucketOverrides = [];

    protected function setUp(): void
    {
        parent::setUp();
        (require base_path('database/proposals/create_file_deletions.php'))->up();
        config(['jairoads_documents.supabase_url' => 'https://disposable-storage.test', 'jairoads_documents.service_role_key' => 'sb_secret_disposable',
            'jairoads_documents.bucket' => 'private-documents', 'jairoads_monthly_updates.supabase_url' => 'https://disposable-storage.test',
            'jairoads_monthly_updates.service_role_key' => 'sb_secret_disposable', 'jairoads_monthly_updates.bucket' => 'private-media']);
        Http::preventStrayRequests();
        Http::fake(['*/storage/v1/bucket/*' => fn ($request) => Http::response($this->bucketOverrides + ['id' => basename($request->url()), 'public' => false, 'versioning_status' => 'DISABLED'])]);
    }

    /** @return array<string,mixed> */
    private function files(string $role = 'Admin'): array
    {
        $f = $this->fixture($role);
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
        $documents = $media = [];
        foreach ([1, 2] as $i) {
            $documents[] = (int) DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $record,
                'document_title' => 'Selected document '.$i, 'file_name' => 'document-'.$i.'.pdf',
                'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-00000000000'.$i.'.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
            $media[] = (int) DB::table('jairoads_next.media')->insertGetId(['monthly_update_id' => $update, 'file_name' => 'photo-'.$i.'.png',
                'file_path' => 'monthly-updates/'.$update.'/00000000-0000-4000-8000-00000000000'.$i.'.png', 'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        }
        DB::table('jairoads_next.audit_logs')->insert(['user_id' => $f['user']->dd_user_account_id, 'actor_identifier' => 'Preserved historical actor',
            'action' => 'CREATE', 'entity_type' => 'MaintenanceProject', 'entity_id' => $f['project'], 'description' => 'Historical entry']);

        return $f + compact('record', 'update', 'documents', 'media');
    }

    private function history(): string
    {
        return DB::table('jairoads_next.audit_logs')->where('description', 'Historical entry')->get()->toJson();
    }

    public static function allowed(): iterable
    {
        yield ['Admin', 'document'];
        yield ['SuperAdmin', 'media'];
    }

    #[DataProvider('allowed')]
    public function test_permanent_deletion_removes_only_one_exact_object_and_metadata_and_is_idempotent(string $role, string $kind): void
    {
        $f = $this->files($role);
        $id = $f[$kind === 'document' ? 'documents' : 'media'][0];
        $table = 'jairoads_next.'.($kind === 'document' ? 'maintenance_documents' : 'media');
        $path = DB::table($table)->where('id', $id)->value('file_path');
        $bucket = $kind === 'document' ? 'private-documents' : 'private-media';
        $objects = [$path => 'selected original bytes', 'untouched-sibling' => 'unchanged sibling bytes'];
        Http::fake(function ($request) use (&$objects, $path, $bucket) {
            if ($request->method() !== 'DELETE') {
                return null;
            }
            $this->assertSame('DELETE', $request->method());
            $this->assertSame('https://disposable-storage.test/storage/v1/object/'.$bucket.'/'.$path, $request->url());
            $this->assertSame('sb_secret_disposable', $request->header('apikey')[0]);
            $this->assertFalse($request->hasHeader('Authorization')); // Opaque key must not be used as a JWT.
            unset($objects[$path]);

            return Http::response(['message' => 'Successfully deleted']);
        });
        $history = $this->history();
        $snapshots = [];
        foreach (['maintenance_projects', 'maintenance_records', 'monthly_updates', 'maintenance_documents', 'media'] as $name) {
            $q = DB::table('jairoads_next.'.$name)->orderBy('id');
            if ('jairoads_next.'.$name === $table) {
                $q->where('id', '!=', $id);
            }
            $snapshots[$name] = $q->get()->toJson();
        }
        $url = '/dd-phase3/files/'.$kind.'/'.$id;
        $this->getJson($url.'/deletion-review')->assertOk()->assertJsonPath('can_delete', true)->assertJsonMissingPath('file_path');
        Http::assertNothingSent();
        $this->deleteJson($url, ['requested_by' => 999999, 'user_id' => 999999])->assertOk()->assertJsonPath('state', 'completed');
        $this->deleteJson($url)->assertOk()->assertJsonPath('state', 'completed');
        Http::assertSentCount(2); // One bucket verification and one exact-object DELETE.
        $this->assertArrayNotHasKey($path, $objects);
        $this->assertSame('unchanged sibling bytes', $objects['untouched-sibling']);
        $this->assertDatabaseMissing($table, ['id' => $id]);
        foreach ($snapshots as $name => $snapshot) {
            $this->assertSame($snapshot, DB::table('jairoads_next.'.$name)->orderBy('id')->get()->toJson());
        }
        $this->assertSame($history, $this->history());
        $event = DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->sole();
        $this->assertSame($kind === 'document' ? 'MaintenanceDocument' : 'Media', $event->entity_type);
        $this->assertSame($id, (int) $event->entity_id);
        $this->assertSame((int) $f['user']->dd_user_account_id, (int) $event->user_id);
        $this->assertStringNotContainsString($path, json_encode($event));
        $this->assertNull($event->recipient_user_id); // No new notification policy/fan-out.
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['kind' => $kind, 'entity_id' => $id, 'state' => 'completed', 'object_path' => null]);
    }

    public static function forbidden(): iterable
    {
        foreach (['Engineer', 'Viewer', 'Admin', 'SuperAdmin'] as $role) {
            yield [$role];
        }
    }

    #[DataProvider('forbidden')]
    public function test_unauthorized_or_inactive_accounts_cannot_delete_even_by_direct_http(string $role): void
    {
        $f = $this->files($role);
        if (in_array($role, ['Admin', 'SuperAdmin'], true)) {
            DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        }
        Http::fake();
        foreach (['document' => $f['documents'][0], 'media' => $f['media'][0]] as $kind => $id) {
            $this->deleteJson('/dd-phase3/files/'.$kind.'/'.$id)->assertForbidden();
            $this->getJson('/dd-phase3/files/'.$kind.'/'.$id.'/deletion-review')->assertForbidden();
        }
        $this->assertSame(0, DB::table('jairoads_next.file_deletions')->count());
        Http::assertNothingSent();
    }

    public static function failures(): iterable
    {
        yield 'forbidden' => [403, ['code' => 'AccessDenied']];
        yield 'bucket missing' => [404, ['code' => 'NoSuchBucket']];
        yield 'ambiguous 404' => [404, []];
        yield 'server error' => [503, ['message' => 'must not leak sb_secret_disposable /private/path']];
        yield 'malformed success' => [200, []];
        yield 'timeout after removal' => [0, []];
    }

    #[DataProvider('failures')]
    public function test_storage_failures_retain_a_recoverable_intent_without_false_success(int $status, array $body): void
    {
        $f = $this->files();
        $sequence = Http::fakeSequence('*/storage/v1/object/*');
        if ($status === 0) {
            $sequence->pushFailedConnection('private path and credential must not leak');
        } else {
            $sequence->push($body, $status);
        }
        $sequence->push(['code' => 'NoSuchKey'], 404);
        $url = '/dd-phase3/files/document/'.$f['documents'][0];
        $history = $this->history();
        $response = $this->deleteJson($url)->assertStatus(202)->assertJsonPath('state', 'pending');
        $this->assertStringNotContainsString('sb_secret_disposable', $response->getContent());
        $this->assertStringNotContainsString('maintenance-records/', $response->getContent());
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['documents'][0]]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        $this->assertSame($history, $this->history());
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['state' => 'pending', 'last_error_code' => 'storage_unavailable']);
        // A new process/service need not know whether the timed-out request removed bytes.
        $this->app->make(PermanentFileDeletion::class); // No in-memory deletion state.
        $this->deleteJson($url)->assertOk()->assertJsonPath('state', 'completed');
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
    }

    public static function unsafeBuckets(): iterable
    {
        yield 'versioned' => [['versioning_status' => 'ENABLED']];
        yield 'suspended' => [['versioning_status' => 'SUSPENDED']];
        yield 'unknown' => [['versioning_status' => null]];
        yield 'public' => [['public' => true]];
        yield 'wrong bucket' => [['id' => 'unrelated-bucket']];
    }

    #[DataProvider('unsafeBuckets')]
    public function test_unverified_or_versioned_buckets_never_issue_object_delete(array $metadata): void
    {
        $f = $this->files();
        $this->bucketOverrides = $metadata;
        $this->deleteJson('/dd-phase3/files/document/'.$f['documents'][0])->assertStatus(202)->assertJsonPath('state', 'pending');
        Http::assertNotSent(fn ($request) => $request->method() === 'DELETE');
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['documents'][0]]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
    }

    public function test_audit_failure_after_storage_removal_rolls_metadata_back_and_reconciles_once(): void
    {
        $f = $this->files();
        Http::fake(['*/storage/v1/object/*' => fn () => Http::response(['message' => 'Successfully deleted'])]);
        DB::unprepared("CREATE FUNCTION jairoads_next.reject_permanent_delete_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'DELETE' THEN RAISE EXCEPTION 'Disposable audit insertion failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_permanent_delete_audit BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_permanent_delete_audit()");
        $url = '/dd-phase3/files/media/'.$f['media'][0];
        $this->deleteJson($url)->assertStatus(202);
        $this->assertDatabaseHas('jairoads_next.media', ['id' => $f['media'][0]]);
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['state' => 'pending', 'last_error_code' => 'database_finalize_failed']);
        $this->getJson('/dd-phase3/files/media/'.$f['media'][0])->assertStatus(409);
        DB::statement('DROP TRIGGER reject_permanent_delete_audit ON jairoads_next.audit_logs');
        Http::fake(['*/storage/v1/object/*' => fn () => Http::response(['code' => 'NoSuchKey'], 404)]);
        $this->artisan('jairoads:resume-file-deletions')->assertSuccessful();
        $this->deleteJson($url)->assertOk();
        $this->assertDatabaseMissing('jairoads_next.media', ['id' => $f['media'][0]]);
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
    }

    public function test_invalid_paths_other_parent_paths_shared_objects_and_browser_paths_are_rejected(): void
    {
        $f = $this->files();
        Http::fake();
        $url = '/dd-phase3/files/document/'.$f['documents'][0];
        $this->deleteJson($url, ['file_path' => 'any/arbitrary/object'])->assertUnprocessable();
        foreach (['../escape.pdf', 'maintenance-records/999/00000000-0000-4000-8000-000000000001.pdf', 'maintenance-records/'.$f['record']."/00000000-0000-4000-8000-000000000001.pdf\n"] as $path) {
            DB::table('jairoads_next.maintenance_documents')->where('id', $f['documents'][0])->update(['file_path' => $path]);
            $this->deleteJson($url)->assertUnprocessable();
        }
        $path = DB::table('jairoads_next.maintenance_documents')->where('id', $f['documents'][1])->value('file_path');
        DB::table('jairoads_next.maintenance_documents')->where('id', $f['documents'][0])->update(['file_path' => $path]);
        $this->deleteJson($url)->assertUnprocessable();
        Http::assertNothingSent();
        $this->assertSame(0, DB::table('jairoads_next.file_deletions')->count());
    }

    public function test_a_publishable_or_anon_key_cannot_authorize_destructive_storage_requests(): void
    {
        $f = $this->files();
        config(['jairoads_documents.service_role_key' => 'sb_publishable_not_a_server_key']);
        Http::fake();
        $this->deleteJson('/dd-phase3/files/document/'.$f['documents'][0])->assertStatus(202);
        Http::assertNothingSent();
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['documents'][0]]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
    }

    public function test_recovery_refuses_changed_storage_configuration_or_target(): void
    {
        $f = $this->files();
        Http::fake(['*/storage/v1/object/*' => fn () => Http::response([], 503)]);
        $url = '/dd-phase3/files/document/'.$f['documents'][0];
        $this->deleteJson($url)->assertStatus(202);
        config(['jairoads_documents.bucket' => 'other-private-bucket']);
        Http::fake();
        $this->deleteJson($url)->assertStatus(202);
        Http::assertNothingSent();
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['last_error_code' => 'storage_configuration_changed']);
        config(['jairoads_documents.bucket' => 'private-documents']);
        DB::table('jairoads_next.maintenance_documents')->where('id', $f['documents'][0])->update(['file_name' => 'different-object-reference.pdf']);
        $this->deleteJson($url)->assertStatus(202);
        Http::assertNothingSent();
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['last_error_code' => 'target_changed']);
    }

    public function test_revocation_blocks_storage_retries_until_an_active_admin_reconfirms(): void
    {
        $f = $this->files();
        Http::fakeSequence('*/storage/v1/object/*')->push([], 503)->push(['code' => 'NoSuchKey'], 404);
        $url = '/dd-phase3/files/document/'.$f['documents'][0];
        $this->deleteJson($url)->assertStatus(202);
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $count = Http::recorded()->count();
        $this->artisan('jairoads:resume-file-deletions')->assertFailed();
        $this->assertSame($count, Http::recorded()->count()); // No new destructive HTTP call while revoked.
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['last_error_code' => 'authorization_revoked']);
        $this->deleteJson($url)->assertForbidden();
        $replacement = $this->account('SuperAdmin');
        $this->withSession(['password_hash_web' => null])->actingAs($replacement)->deleteJson($url)->assertOk();
        $event = DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->sole();
        $this->assertSame((int) $replacement->dd_user_account_id, (int) $event->user_id);
        $this->assertSame((int) $f['user']->dd_user_account_id, json_decode($event->old_value, true)['initiated_by']);
    }

    public function test_database_failure_before_acceptance_never_calls_storage(): void
    {
        $f = $this->files();
        DB::unprepared("CREATE FUNCTION jairoads_next.reject_delete_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'disposable intent failure'; END $$; CREATE TRIGGER reject_delete_intent BEFORE INSERT ON jairoads_next.file_deletions FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_delete_intent()");
        Http::fake();
        $this->deleteJson('/dd-phase3/files/document/'.$f['documents'][0])->assertStatus(503)->assertJsonPath('state', 'unconfirmed');
        Http::assertNothingSent();
        $this->assertSame(0, DB::table('jairoads_next.file_deletions')->count());
        $this->assertSame(2, DB::table('jairoads_next.maintenance_documents')->count());
    }

    public function test_restrictive_database_failure_after_storage_deletion_remains_recoverable(): void
    {
        $f = $this->files();
        DB::statement('CREATE TABLE jairoads_next.test_file_dependency (media_id bigint REFERENCES jairoads_next.media(id) ON DELETE RESTRICT)');
        DB::table('jairoads_next.test_file_dependency')->insert(['media_id' => $f['media'][0]]);
        Http::fakeSequence('*/storage/v1/object/*')->push(['message' => 'Successfully deleted'])->push(['code' => 'NoSuchKey'], 404);
        $url = '/dd-phase3/files/media/'.$f['media'][0];
        $this->deleteJson($url)->assertStatus(202)->assertJsonPath('state', 'pending');
        $this->assertDatabaseHas('jairoads_next.media', ['id' => $f['media'][0]]);
        $this->assertDatabaseHas('jairoads_next.file_deletions', ['last_error_code' => 'database_finalize_failed']);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        DB::table('jairoads_next.test_file_dependency')->delete(); // Test-only dependency resolution; never cascade real data.
        $this->deleteJson($url)->assertOk();
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
    }

    public function test_a_silent_database_delete_refusal_does_not_report_success(): void
    {
        $f = $this->files();
        DB::unprepared('CREATE FUNCTION jairoads_next.retain_test_document() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$; CREATE TRIGGER retain_test_document BEFORE DELETE ON jairoads_next.maintenance_documents FOR EACH ROW EXECUTE FUNCTION jairoads_next.retain_test_document()');
        Http::fakeSequence('*/storage/v1/object/*')->push(['message' => 'Successfully deleted'])->push(['code' => 'NoSuchKey'], 404);
        $url = '/dd-phase3/files/document/'.$f['documents'][0];
        $this->deleteJson($url)->assertStatus(202)->assertJsonPath('state', 'pending');
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['documents'][0]]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        DB::statement('DROP TRIGGER retain_test_document ON jairoads_next.maintenance_documents');
        $this->deleteJson($url)->assertOk();
    }

    public function test_operational_table_is_private_and_sequence_has_no_public_grants(): void
    {
        $this->assertTrue(DB::selectOne("SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = 'jairoads_next.file_deletions'::regclass")->enabled);
        foreach (['jairoads_next.file_deletions', 'jairoads_next.file_deletions_id_seq'] as $table) {
            $this->assertSame(0, (int) DB::selectOne('SELECT count(*) AS n FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid = ?::regclass AND a.grantee = 0', [$table])->n);
        }
    }

    public function test_deactivation_while_request_waits_prevents_acceptance_and_storage_io(): void
    {
        $f = $this->files();
        DB::commit();
        $marker = tempnam(sys_get_temp_dir(), 'jairoads-file-delete-');
        $worker = null;
        try {
            DB::beginTransaction();
            DB::table('jairoads_next.maintenance_documents')->where('id', $f['documents'][0])->lockForUpdate()->first();
            $worker = new Process([PHP_BINARY, __DIR__.'/file-deletion-worker.php', (string) $f['user']->id, (string) $f['documents'][0], 'unused', $marker]);
            $worker->setTimeout(20);
            $worker->start();
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne("SELECT query FROM pg_stat_activity WHERE application_name = 'file_deletion_worker' AND wait_event_type = 'Lock'");
                if ($waiting !== null) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertNotNull($waiting, $worker->getOutput().$worker->getErrorOutput());
            $this->assertStringContainsString('maintenance_documents', $waiting->query);
            DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
            DB::commit();
            $worker->wait();
            $this->assertSame(403, json_decode($worker->getOutput(), true)['status']);
            $this->assertSame('', file_get_contents($marker));
            $this->assertSame(0, DB::table('jairoads_next.file_deletions')->count());
            $this->assertSame(2, DB::table('jairoads_next.maintenance_documents')->count());
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            unlink($marker);
            DB::statement('DROP TABLE jairoads_next.file_deletions');
            DB::unprepared('TRUNCATE public.users, jairoads_next.user_accounts, jairoads_next.engineers, jairoads_next.lgus CASCADE');
        }
    }

    public static function concurrency(): iterable
    {
        yield 'concurrent confirmations' => [false];
        yield 'process death after remote removal' => [true];
    }

    #[DataProvider('concurrency')]
    public function test_concurrent_requests_or_process_death_keep_durable_exactly_once_recovery(bool $kill): void
    {
        $f = $this->files();
        $url = '/dd-phase3/files/document/'.$f['documents'][0];
        if ($kill) {
            Http::fakeSequence('*/storage/v1/object/*')->push([], 503)->push(['code' => 'NoSuchKey'], 404);
            $this->deleteJson($url)->assertStatus(202); // Commit intent before the crash/recovery worker starts.
        }
        DB::commit();
        $marker = tempnam(sys_get_temp_dir(), 'jairoads-file-delete-');
        $workers = [];
        try {
            DB::beginTransaction();
            DB::statement('SELECT pg_advisory_xact_lock(1927710991)');
            for ($i = 0; $i < ($kill ? 1 : 2); $i++) {
                $worker = new Process([PHP_BINARY, __DIR__.'/file-deletion-worker.php', (string) $f['user']->id,
                    (string) $f['documents'][0], 'unused', $marker]);
                $worker->setTimeout(20);
                $worker->start();
                $workers[] = $worker;
            }
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $blocked = (int) DB::selectOne("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'file_deletion_worker' AND wait_event_type = 'Lock' AND query LIKE '%1927710991%'")->n;
                if ($blocked > 0) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertGreaterThan(0, $blocked, implode(' | ', array_map(fn (Process $p): string => $p->getErrorOutput().$p->getOutput(), $workers)));
            $this->assertSame("object removed\n", file_get_contents($marker));
            if ($kill) {
                $workers[0]->signal(9);
                $workers[0]->wait();
            }
            DB::commit();
            if ($kill) {
                $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['documents'][0]]);
                $this->assertDatabaseHas('jairoads_next.file_deletions', ['state' => 'pending']);
                $this->artisan('jairoads:resume-file-deletions')->assertSuccessful();
            } else {
                foreach ($workers as $worker) {
                    $worker->wait();
                    $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
                    $this->assertContains(json_decode($worker->getOutput(), true)['status'], [200, 202]);
                }
            }
            $this->deleteJson($url)->assertOk();
            $this->assertDatabaseMissing('jairoads_next.maintenance_documents', ['id' => $f['documents'][0]]);
            $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
            $this->assertSame("object removed\n", file_get_contents($marker));
            $this->assertSame(1, DB::table('jairoads_next.maintenance_documents')->count());
            $this->assertSame(2, DB::table('jairoads_next.media')->count());
        } finally {
            foreach ($workers as $worker) {
                $worker->stop();
            }
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            unlink($marker);
            DB::statement('DROP TABLE jairoads_next.file_deletions'); // Guarded disposable fixture only.
            DB::unprepared('TRUNCATE public.users, jairoads_next.user_accounts, jairoads_next.engineers, jairoads_next.lgus CASCADE');
        }
    }
}
