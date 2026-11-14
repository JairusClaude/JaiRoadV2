<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

final class CanonicalPrivateUploadContractTest extends PostgresTestCase
{
    private function maintenanceRecord(): array
    {
        $fixture = $this->fixture('Admin');
        $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($fixture['project'], $fixture['engineer'])
                + ['created_by' => $fixture['user']->dd_user_account_id]
        );

        return [$fixture, $id];
    }

    private function storage(): void
    {
        config([
            'jairoads_documents.supabase_url' => 'https://disposable-storage.invalid',
            'jairoads_documents.service_role_key' => 'sb_secret_DISPOSABLE_TEST_ONLY',
            'jairoads_documents.bucket' => 'private-documents',
            'jairoads_monthly_updates.supabase_url' => 'https://disposable-storage.invalid',
            'jairoads_monthly_updates.service_role_key' => 'sb_secret_DISPOSABLE_TEST_ONLY',
            'jairoads_monthly_updates.bucket' => 'private-media',
            'jairoads_monthly_updates.canonical_writes_enabled' => true,
        ]);
    }

    private function png(): UploadedFile
    {
        // Disposable 1x1 PNG; content MIME must determine the canonical media type.
        return UploadedFile::fake()->createWithContent('evidence.png', (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YlV8XQAAAAASUVORK5CYII=',
            true
        ));
    }

    public function test_pdf_uses_private_storage_and_canonical_document_table_not_media(): void
    {
        [$fixture, $record] = $this->maintenanceRecord();
        $this->storage();
        Http::fake(['https://disposable-storage.invalid/storage/v1/object/private-documents/*' => Http::response(['Key' => 'disposable'], 200)]);

        $file = UploadedFile::fake()->createWithContent('proof.pdf', "%PDF-1.4\nDisposable document\n");
        $this->post('/dd-phase3/ops/documents', [
            'maintenance_id' => $record, 'document_title' => 'Approved paper', 'file' => $file,
        ])->assertRedirect();

        $doc = DB::table('jairoads_next.maintenance_documents')->sole();
        $this->assertSame($record, (int) $doc->maintenance_id);
        $this->assertSame((int) $fixture['user']->dd_user_account_id, (int) $doc->uploaded_by);
        $this->assertSame('proof.pdf', $doc->file_name);
        $this->assertMatchesRegularExpression('#^maintenance-records/'.$record.'/[0-9a-f-]+\\.pdf$#', $doc->file_path);
        $this->assertSame(0, DB::table('jairoads_next.media')->count());
        $this->assertSame('CREATE', DB::table('jairoads_next.audit_logs')->sole()->action);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request): bool => $request->method() === 'POST'
            && str_contains($request->url(), '/object/private-documents/'.$doc->file_path)
            && $request->hasHeader('apikey') && ! $request->hasHeader('Authorization'));
    }

    public function test_png_upload_is_linked_to_monthly_update_and_privately_audited(): void
    {
        [$fixture, $record] = $this->maintenanceRecord();
        $this->storage();
        $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record, 'update_month' => '2026-11',
            'progress_percentage' => 15, 'created_by' => $fixture['user']->dd_user_account_id,
        ]);
        Http::fake(['https://disposable-storage.invalid/storage/v1/object/private-media/*' => Http::response(['Key' => 'disposable'], 200)]);

        $this->post('/dd-phase3/ops/media', [
            'monthly_update_id' => $update, 'file' => $this->png(),
        ])->assertRedirect();

        $media = DB::table('jairoads_next.media')->sole();
        $this->assertSame($update, (int) $media->monthly_update_id);
        $this->assertSame('image/png', $media->file_type);
        $this->assertSame('evidence.png', $media->file_name);
        $this->assertSame((int) $fixture['user']->dd_user_account_id, (int) $media->uploaded_by);
        $this->assertMatchesRegularExpression('#^monthly-updates/'.$update.'/[0-9a-f-]+\\.png$#', $media->file_path);
        $event = DB::table('jairoads_next.audit_logs')->sole();
        $this->assertSame('Media', $event->entity_type);
        $this->assertSame('CREATE', $event->action);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request): bool => $request->method() === 'POST'
            && str_contains($request->url(), '/object/private-media/'.$media->file_path)
            && $request->hasHeader('apikey') && ! $request->hasHeader('Authorization'));
    }

    public function test_viewer_and_unassigned_engineer_cannot_upload_any_private_media(): void
    {
        [$fixture, $record] = $this->maintenanceRecord();
        $this->storage();
        $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record, 'update_month' => '2026-11',
            'progress_percentage' => 15, 'created_by' => $fixture['user']->dd_user_account_id,
        ]);
        Http::fake();
        foreach (['Viewer', 'Engineer'] as $role) {
            $this->actingAs($this->account($role))->postJson('/dd-phase3/ops/media', [
                'monthly_update_id' => $update, 'file' => $this->png(),
            ])->assertForbidden();
        }
        $this->assertSame(0, DB::table('jairoads_next.media')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        Http::assertNothingSent();
    }

    public function test_storage_rejection_never_commits_document_metadata_or_audit(): void
    {
        [, $record] = $this->maintenanceRecord();
        $this->storage();
        Http::fake(['https://disposable-storage.invalid/storage/v1/object/private-documents/*' => Http::response(['code' => 'StorageUnavailable'], 503)]);
        $this->postJson('/dd-phase3/ops/documents', [
            'maintenance_id' => $record, 'document_title' => 'No stored bytes',
            'file' => UploadedFile::fake()->createWithContent('proof.pdf', "%PDF-1.4\nDisposable document\n"),
        ])->assertServerError();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_documents')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }
}
