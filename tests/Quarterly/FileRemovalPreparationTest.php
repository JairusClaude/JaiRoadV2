<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;

final class FileRemovalPreparationTest extends PostgresTestCase
{
    public static function kinds(): iterable
    {
        yield ['document'];
        yield ['media'];
    }

    #[DataProvider('kinds')]
    public function test_review_is_non_destructive_safe_and_administrative_only(string $kind): void
    {
        [$f,$document,$media] = $this->files();
        $id = $kind === 'document' ? $document : $media;
        foreach ([PrivateSupabaseStorage::class, PrivateMonthlyMediaStorage::class] as $service) {
            $mock = Mockery::mock($service);
            $mock->shouldNotReceive('fetch');
            $mock->shouldNotReceive('upload');
            $mock->shouldNotReceive('removeAfterFailure');
            $this->app->instance($service, $mock);
        }
        $history = DB::table('jairoads_next.audit_logs')->get()->toJson();
        $this->getJson('/dd-phase3/files/'.$kind.'/'.$id.'/deletion-review')->assertOk()->assertJsonPath('can_delete', false)->assertJsonPath('policy_status', 'pending_storage_retention')->assertJsonMissingPath('file_path');
        $response = $this->deleteJson('/dd-phase3/ops/'.($kind === 'document' ? 'documents' : 'media').'/'.$id);
        $this->assertContains($response->status(), [404, 405]);
        $this->assertSame(1, DB::table('jairoads_next.maintenance_documents')->count());
        $this->assertSame(1, DB::table('jairoads_next.media')->count());
        $this->assertSame($history, DB::table('jairoads_next.audit_logs')->get()->toJson());
        foreach (['Engineer', 'Viewer'] as $role) {
            $login = $role === 'Engineer' ? $this->account($role, $this->engineer()) : $this->account($role);
            $this->withSession(['password_hash_web' => null])->actingAs($login)->getJson('/dd-phase3/files/'.$kind.'/'.$id.'/deletion-review')->assertForbidden();
        }
    }

    public function test_invalid_file_access_checks_parent_scope_before_private_storage(): void
    {
        [$f,$document,$media] = $this->files();
        $this->getJson('/dd-phase3/files/document/999999/deletion-review')->assertNotFound();
        $this->getJson('/dd-phase3/files/unknown/'.$document.'/deletion-review')->assertNotFound();
        foreach ([PrivateSupabaseStorage::class, PrivateMonthlyMediaStorage::class] as $service) {
            $mock = Mockery::mock($service);
            $mock->shouldNotReceive('fetch');
            $this->app->instance($service, $mock);
        }
        $engineer = $this->engineer();
        $login = $this->account('Engineer', $engineer);
        $this->road($engineer);
        $this->withSession(['password_hash_web' => null])->actingAs($login)->getJson('/dd-phase3/files/document/'.$document)->assertForbidden();
        $this->getJson('/dd-phase3/files/media/'.$media)->assertForbidden();
        $this->assertSame(1, DB::table('jairoads_next.maintenance_documents')->count());
    }

    public function test_existing_private_download_and_storage_failure_do_not_delete_metadata(): void
    {
        [$f,$document,$media] = $this->files();
        $mock = Mockery::mock(PrivateSupabaseStorage::class);
        $mock->shouldReceive('fetch')->once()->with('private/fixture.pdf')->andReturn(new Response(new \GuzzleHttp\Psr7\Response(200, [], 'Disposable private bytes')));
        $this->app->instance(PrivateSupabaseStorage::class, $mock);
        $this->get('/dd-phase3/files/document/'.$document)->assertOk()->assertContent('Disposable private bytes')->assertHeader('Cache-Control', 'no-store, private');
        $failed = Mockery::mock(PrivateMonthlyMediaStorage::class);
        $failed->shouldReceive('fetch')->once()->andThrow(new \RuntimeException('Disposable storage unavailable'));
        $failed->shouldNotReceive('removeAfterFailure');
        $this->app->instance(PrivateMonthlyMediaStorage::class, $failed);
        $this->getJson('/dd-phase3/files/media/'.$media)->assertServerError();
        $this->assertSame(1, DB::table('jairoads_next.media')->count());
    }

    private function files(): array
    {
        $f = $this->fixture();
        $id = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $id, 'update_month' => '2026-10', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
        $document = DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $id, 'document_title' => 'Fixture', 'file_name' => 'fixture.pdf', 'file_path' => 'private/fixture.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $media = DB::table('jairoads_next.media')->insertGetId(['monthly_update_id' => $update, 'file_name' => 'fixture.png', 'file_type' => 'image/png', 'file_path' => 'private/fixture.png', 'uploaded_by' => $f['user']->dd_user_account_id]);

        return [$f, (int) $document, (int) $media];
    }
}
