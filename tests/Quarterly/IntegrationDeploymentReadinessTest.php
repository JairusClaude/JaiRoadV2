<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\IntegrationDeploymentReadiness;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class IntegrationDeploymentReadinessTest extends PostgresTestCase
{
    public function test_configuration_report_is_secret_free_and_never_claims_external_verification(): void
    {
        config([
            'app.url' => 'https://staging.jairoads.invalid',
            'jairoads_documents.supabase_url' => 'https://synthetic-storage.invalid',
            'jairoads_documents.service_role_key' => 'sb_secret_DO_NOT_USE_SYNTHETIC_123',
            'jairoads_documents.bucket' => 'private-docs',
            'jairoads_monthly_updates.supabase_url' => 'https://synthetic-storage.invalid',
            'jairoads_monthly_updates.service_role_key' => '',
            'jairoads_monthly_updates.bucket' => 'private-media',
            'mail.default' => 'smtp',
            'mail.from.address' => 'noreply@jairoads.invalid',
            'fortify.passkeys.relying_party_id' => 'staging.jairoads.invalid',
            'fortify.passkeys.allowed_origins' => ['https://staging.jairoads.invalid'],
            'jairoads_maps.routing' => 'https://synthetic-routing.invalid/route/v1/driving',
            'jairoads_maps.geocoding' => 'https://synthetic-geocoding.invalid/api',
        ]);
        Http::fake();
        $report = app(IntegrationDeploymentReadiness::class)->report();
        $this->assertTrue($report['ready_for_live_probes']);
        $this->assertFalse($report['network_probes_performed']);
        $this->assertNotEmpty($report['manual_gates']);
        foreach ($report['checks'] as $check) {
            $this->assertTrue($check);
        }
        $this->assertSame(0, Artisan::call('jairoads:integration-readiness'));
        $output = Artisan::output();
        $this->assertSame($report, json_decode($output, true, 512, JSON_THROW_ON_ERROR));
        foreach ([
            'sb_secret_DO_NOT_USE_SYNTHETIC_123',
            'https://synthetic-storage.invalid',
            'noreply@jairoads.invalid',
            'staging.jairoads.invalid',
        ] as $privateDetail) {
            $this->assertStringNotContainsString($privateDetail, $output);
        }
        Http::assertNothingSent();
    }

    public function test_unsafe_or_incomplete_integrations_fail_configuration_checks_without_network_requests(): void
    {
        config([
            'app.url' => 'http://staging.jairoads.invalid',
            'jairoads_documents.supabase_url' => 'https://synthetic-storage.invalid?token=exposed',
            'jairoads_documents.service_role_key' => 'sb_publishable_disposable',
            'jairoads_documents.bucket' => 'private/docs',
            'jairoads_monthly_updates.supabase_url' => 'https://different-project.invalid',
            'jairoads_monthly_updates.service_role_key' => '',
            'jairoads_monthly_updates.bucket' => 'private/docs',
            'mail.default' => 'log',
            'mail.from.address' => 'hello@example.com',
            'fortify.passkeys.relying_party_id' => 'other.invalid',
            'fortify.passkeys.allowed_origins' => ['http://staging.jairoads.invalid'],
            'jairoads_maps.routing' => 'http://insecure-routing.invalid',
            'jairoads_maps.geocoding' => 'https://synthetic.invalid/api?api_key=secret',
        ]);
        Http::fake();
        $checks = app(IntegrationDeploymentReadiness::class)->report();
        $this->assertFalse($checks['ready_for_live_probes']);
        foreach ([
            'application_origin_https', 'document_storage_https',
            'document_storage_server_secret', 'document_bucket_name_valid',
            'monthly_media_server_secret', 'monthly_media_bucket_name_valid',
            'document_and_media_buckets_distinct', 'password_reset_mail_transport',
            'password_reset_sender', 'passkey_origin_matches_app_url',
            'passkey_relying_party_matches_host', 'map_routing_https',
            'map_geocoding_https',
        ] as $field) {
            $this->assertFalse($checks['checks'][$field], $field);
        }
        Http::assertNothingSent();
    }

    public function test_private_document_and_media_downloads_keep_server_secret_out_of_bearer_and_browser_urls(): void
    {
        config([
            'jairoads_documents.supabase_url' => 'https://synthetic-storage.invalid',
            'jairoads_documents.service_role_key' => 'sb_secret_DISPOSABLE_ONLY',
            'jairoads_documents.bucket' => 'private-docs',
            'jairoads_monthly_updates.supabase_url' => 'https://synthetic-storage.invalid',
            'jairoads_monthly_updates.service_role_key' => '',
            'jairoads_monthly_updates.bucket' => 'private-media',
        ]);
        Http::fake([
            'https://synthetic-storage.invalid/storage/v1/object/authenticated/private-docs/*' => Http::response('%PDF-1.4 synthetic', 200),
            'https://synthetic-storage.invalid/storage/v1/object/authenticated/private-media/*' => Http::response('synthetic-image', 200),
        ]);
        $document = app(PrivateSupabaseStorage::class)->fetch(
            'maintenance-records/71/00000000-0000-4000-8000-000000000001.pdf'
        );
        $media = app(PrivateMonthlyMediaStorage::class)->fetch(
            'monthly-updates/29/00000000-0000-4000-8000-000000000001.png'
        );
        $this->assertSame('%PDF-1.4 synthetic', $document->body());
        $this->assertSame('synthetic-image', $media->body());
        Http::assertSentCount(2);
        Http::assertSent(fn ($request): bool => $request->hasHeader('apikey')
            && $request->header('apikey')[0] === 'sb_secret_DISPOSABLE_ONLY'
            && ! $request->hasHeader('Authorization')
            && ! str_contains($request->url(), 'sb_secret_')
            && str_contains($request->url(), '/object/authenticated/')
        );
    }

    public function test_media_credential_never_falls_back_to_a_different_supabase_project(): void
    {
        config([
            'jairoads_documents.supabase_url' => 'https://synthetic-storage.invalid',
            'jairoads_documents.service_role_key' => 'sb_secret_DISPOSABLE_ONLY',
            'jairoads_monthly_updates.supabase_url' => 'https://different-project.invalid',
            'jairoads_monthly_updates.service_role_key' => '',
        ]);
        Http::fake();
        $this->assertFalse(app(PrivateMonthlyMediaStorage::class)->configured());
        try {
            app(PrivateMonthlyMediaStorage::class)->fetch(
                'monthly-updates/29/00000000-0000-4000-8000-000000000001.png'
            );
            $this->fail('A different project may not inherit a server-only storage secret.');
        } catch (RuntimeException $error) {
            $this->assertSame('Monthly media Supabase Storage is not configured.', $error->getMessage());
        }
        Http::assertNothingSent();
    }

    public function test_public_bucket_rejects_permanent_delete_before_any_object_delete_request(): void
    {
        config([
            'jairoads_documents.supabase_url' => 'https://synthetic-storage.invalid',
            'jairoads_documents.service_role_key' => 'sb_secret_DISPOSABLE_ONLY',
            'jairoads_documents.bucket' => 'private-docs',
        ]);
        Http::fake([
            'https://synthetic-storage.invalid/storage/v1/bucket/private-docs' => Http::response(['id' => 'private-docs', 'public' => true, 'versioning_status' => 'DISABLED'], 200),
            'https://synthetic-storage.invalid/storage/v1/object/*' => Http::response(['message' => 'Successfully deleted'], 200),
        ]);
        try {
            app(PrivateSupabaseStorage::class)->removePermanently(
                'maintenance-records/71/00000000-0000-4000-8000-000000000001.pdf'
            );
            $this->fail('A public bucket may not be treated as verified private permanent deletion.');
        } catch (RuntimeException $error) {
            $this->assertSame('Private unversioned bucket removal could not be verified.', $error->getMessage());
        }
        Http::assertSentCount(1);
        Http::assertNotSent(fn ($request): bool => $request->method() === 'DELETE');
    }

    public function test_strict_mode_fails_on_incomplete_configuration_without_network_requests(): void
    {
        config([
            'app.url' => 'http://insecure.test',
            'mail.default' => 'array',
            'fortify.passkeys.allowed_origins' => [],
        ]);
        Http::fake();
        $this->assertSame(1, Artisan::call('jairoads:integration-readiness', ['--strict' => true]));
        $report = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertFalse($report['ready_for_live_probes']);
        Http::assertNothingSent();
    }
}
