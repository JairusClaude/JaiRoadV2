<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\DeploymentTargetSafety;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

final class DeploymentTargetSafetyTest extends TestCase
{
    private function safeSyntheticTarget(): void
    {
        $stage = str_repeat('a', 20);
        $official = str_repeat('b', 20);
        config([
            'jairoads_deployment.target_class' => 'isolated_staging',
            'jairoads_deployment.expected_supabase_ref' => $stage,
            'jairoads_deployment.official_supabase_ref' => $official,
            'jairoads_deployment.restricted_database_role' => 'jairoads_app_runtime',
            'jairoads_documents.supabase_url' => 'https://'.$stage.'.supabase.co',
            'database.default' => 'pgsql',
            'database.connections.pgsql.url' => null,
            'database.connections.pgsql.host' => 'aws-0-ap-southeast-1.pooler.supabase.com',
            'database.connections.pgsql.username' => 'jairoads_app_runtime.'.$stage,
            'database.connections.pgsql.sslmode' => 'require',
            'app.url' => 'https://staging.example.test',
            'app.env' => 'production',
            'app.debug' => false,
            'app.key' => 'base64:'.base64_encode(str_repeat('c', 32)),
            'session.driver' => 'database',
            'cache.default' => 'database',
        ]);
    }

    public function test_isolated_staging_configuration_presents_only_boolean_evidence(): void
    {
        $this->safeSyntheticTarget();
        $report = app(DeploymentTargetSafety::class)->report();
        $this->assertTrue($report['safe_for_release_probes']);
        $this->assertFalse($report['network_probes_performed']);
        $this->assertFalse($report['release_approved']);
        foreach ($report['checks'] as $check) {
            $this->assertTrue($check);
        }
        $this->assertSame(0, Artisan::call('jairoads:deployment-target-preflight'));
        $out = Artisan::output();
        $this->assertStringNotContainsString('jairoads_app_runtime.', $out);
        $this->assertStringNotContainsString('supabase.co', $out);
    }

    public function test_review_instance_cannot_claim_isolation_from_official_project(): void
    {
        $this->safeSyntheticTarget();
        $official = str_repeat('b', 20);
        config([
            'jairoads_deployment.expected_supabase_ref' => $official,
            'jairoads_documents.supabase_url' => 'https://'.$official.'.supabase.co',
            'database.connections.pgsql.username' => 'postgres.'.$official,
            'session.driver' => 'file',
            'cache.default' => 'file',
        ]);
        $checks = app(DeploymentTargetSafety::class)->report()['checks'];
        $this->assertFalse($checks['staging_isolated_from_official']);
        $this->assertFalse($checks['restricted_runtime_username']);
        $this->assertFalse($checks['persistent_sessions']);
        $this->assertSame(1, Artisan::call('jairoads:deployment-target-preflight'));
    }

    public function test_project_mismatch_db_url_and_no_explicit_class_are_rejected(): void
    {
        $this->safeSyntheticTarget();
        config([
            'jairoads_deployment.target_class' => 'review',
            'database.connections.pgsql.url' => 'postgresql://postgres:synthetic-only@db.other.supabase.co:5432/postgres?sslmode=disable',
        ]);
        $report = app(DeploymentTargetSafety::class)->report();
        $this->assertFalse($report['checks']['explicit_deployment_class']);
        $this->assertFalse($report['checks']['postgres_pooler_or_direct_project_matches_target']);
        $this->assertFalse($report['checks']['postgres_ssl_required']);
        $this->assertFalse($report['checks']['restricted_runtime_username']);
        $this->assertFalse($report['safe_for_release_probes']);
    }
}
