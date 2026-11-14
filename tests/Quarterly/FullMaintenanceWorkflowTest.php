<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;

final class FullMaintenanceWorkflowTest extends PostgresTestCase
{
    public function test_engineer_completes_the_canonical_road_to_private_supporting_files_workflow(): void
    {
        $f = $this->fixture('Engineer');
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $geometry = ['type' => 'LineString', 'coordinates' => [[125.95, 7.59], [125.96, 7.60], [125.97, 7.61]]];
        $roadData = ['road_name' => 'Three point road', 'lgu_id' => $lgu, 'kilometers' => 3.2, 'pavement_type' => 'Concrete', 'state_category' => 'Good', 'geojson' => json_encode($geometry)];
        $this->postJson('/dd-phase3/ops/roads', $roadData)->assertRedirect();
        $road = DB::table('jairoads_next.road_coverages')->where('road_name', 'Three point road')->first();
        $this->assertSame($geometry, json_decode($road->geojson, true));
        $this->assertSame($f['engineer'], (int) $road->created_by);
        $this->putJson('/dd-phase3/ops/roads/'.$road->id, array_replace($roadData, ['road_name' => 'Edited three point road']))->assertRedirect();
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Full workflow project', 'road_coverage_id' => $road->id, 'lgu_id' => 999999, 'created_by' => 999999])->assertRedirect();
        $project = DB::table('jairoads_next.maintenance_projects')->where('project_title', 'Full workflow project')->first();
        $this->assertSame((int) $f['user']->dd_user_account_id, (int) $project->created_by);
        $this->assertSame((int) $lgu, (int) DB::table('jairoads_next.road_coverages')->where('id', $project->road_coverage_id)->value('lgu_id'));
        $this->postJson('/dd-phase3/ops/records', $this->recordData((int) $project->id, $f['engineer'], 'Q4'))->assertRedirect();
        $record = DB::table('jairoads_next.maintenance_records')->where('project_id', $project->id)->first();
        $monthly = ['maintenance_id' => $record->id, 'update_month' => '2026-10', 'progress_percentage' => 33.25, 'summary_of_text_reports' => 'Inspected drainage.'];
        $this->postJson('/dd-phase3/ops/updates', $monthly)->assertRedirect();
        $update = DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $record->id)->first();
        $this->assertSame('33.25', $update->progress_percentage);
        $auditCount = DB::table('jairoads_next.audit_logs')->count();
        $this->postJson('/dd-phase3/ops/updates', $monthly)->assertUnprocessable()->assertJsonValidationErrors('update_month');
        foreach ([-1, 101] as $progress) {
            $this->putJson('/dd-phase3/ops/updates/'.$update->id, array_replace($monthly, ['progress_percentage' => $progress]))->assertUnprocessable()->assertJsonValidationErrors('progress_percentage');
        }
        $this->assertSame($auditCount, DB::table('jairoads_next.audit_logs')->count());
        foreach ([['document', PrivateSupabaseStorage::class], ['media', PrivateMonthlyMediaStorage::class]] as [$kind, $class]) {
            $mock = Mockery::mock($class);
            $mock->shouldReceive('configured')->once()->andReturnTrue();
            $mock->shouldReceive('upload')->once();
            $mock->shouldReceive('fetch')->once()->andReturn(new Response(new \GuzzleHttp\Psr7\Response(200, [], 'Disposable private '.$kind)));
            $mock->shouldNotReceive('removeAfterFailure');
            $this->app->instance($class, $mock);
        }
        $this->post('/dd-phase3/ops/documents', ['maintenance_id' => $record->id, 'document_title' => 'Inspection', 'file' => $this->file('document')])->assertRedirect();
        $this->post('/dd-phase3/ops/media', ['monthly_update_id' => $update->id, 'file' => $this->file('media')])->assertRedirect();
        $document = DB::table('jairoads_next.maintenance_documents')->first();
        $media = DB::table('jairoads_next.media')->first();
        foreach ([['document', $document], ['media', $media]] as [$kind, $row]) {
            $this->assertSame((int) $f['user']->dd_user_account_id, (int) $row->uploaded_by);
            $this->get('/dd-phase3/files/'.$kind.'/'.$row->id)->assertOk()->assertContent('Disposable private '.$kind)->assertHeader('Cache-Control', 'no-store, private')->assertHeader('X-Content-Type-Options', 'nosniff');
        }
        $this->putJson('/dd-phase3/ops/records/'.$record->id, array_replace($this->recordData((int) $project->id, $f['engineer'], 'Q4'), ['status' => 'Completed', 'complete_date' => '2026-10-10']))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $record->id, 'status' => 'Completed', 'created_by' => $f['user']->dd_user_account_id]);
        $this->assertSame(1, DB::table('jairoads_next.monthly_updates')->count());
        $this->assertSame(1, DB::table('jairoads_next.maintenance_documents')->count());
        $this->assertSame(1, DB::table('jairoads_next.media')->count());
    }

    public static function kinds(): iterable
    {
        yield ['document', PrivateSupabaseStorage::class];
        yield ['media', PrivateMonthlyMediaStorage::class];
    }

    #[DataProvider('kinds')]
    public function test_audit_failure_after_private_upload_rolls_back_metadata_and_compensates_storage(string $kind, string $class): void
    {
        $f = $this->fixture('Engineer');
        $record = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
        $uploaded = null;
        $mock = Mockery::mock($class);
        $mock->shouldReceive('configured')->once()->andReturnTrue();
        $mock->shouldReceive('upload')->once()->withArgs(function ($file, $path) use (&$uploaded): bool {
            $uploaded = $path;

            return $file instanceof UploadedFile;
        });
        $mock->shouldReceive('removeAfterFailure')->once()->withArgs(static function ($path) use (&$uploaded): bool {
            return $path === $uploaded;
        });
        $this->app->instance($class, $mock);
        DB::connection()->beforeExecuting(static function (string $sql): void {
            if (str_starts_with($sql, 'insert into "jairoads_next"."audit_logs"')) {
                throw new \RuntimeException('Disposable audit insertion failure');
            }
        });
        $payload = $kind === 'document' ? ['maintenance_id' => $record, 'document_title' => 'Atomic upload'] : ['monthly_update_id' => $update];
        $this->post('/dd-phase3/ops/'.($kind === 'document' ? 'documents' : 'media'), $payload + ['file' => $this->file($kind)])->assertServerError();
        $this->assertNotNull($uploaded);
        $this->assertSame(0, DB::table('jairoads_next.maintenance_documents')->count());
        $this->assertSame(0, DB::table('jairoads_next.media')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(1, DB::table('jairoads_next.monthly_updates')->count());
    }

    public static function revokedUploads(): iterable
    {
        foreach (['document', 'media'] as $kind) {
            foreach (['deactivated', 'unassigned', 'reassigned'] as $change) {
                yield $kind.' '.$change => [$kind, $change];
            }
        }
    }

    #[DataProvider('revokedUploads')]
    public function test_upload_losing_authorization_during_storage_io_cannot_commit(string $kind, string $change): void
    {
        $f = $this->fixture('Engineer');
        $record = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
        $replacement = $this->engineer();
        $this->account('Engineer', $replacement);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => true]);
        $class = $kind === 'document' ? PrivateSupabaseStorage::class : PrivateMonthlyMediaStorage::class;
        $mock = Mockery::mock($class);
        $mock->shouldReceive('configured')->once()->andReturnTrue();
        $path = null;
        $mock->shouldReceive('upload')->once()->andReturnUsing(function ($file, $uploaded) use ($change, $f, $record, $replacement, &$path): void {
            $path = $uploaded;
            // Simulate a valid administrative revocation while the HTTP upload was in flight.
            match ($change) {
                'deactivated' => DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]),
                'unassigned' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->update(['is_active' => false]),
                'reassigned' => DB::table('jairoads_next.maintenance_records')->where('id', $record)->update(['managing_engineer_id' => $replacement]),
            };
        });
        $mock->shouldReceive('removeAfterFailure')->once()->withArgs(static function ($uploaded) use (&$path): bool {
            return $uploaded === $path;
        });
        $this->app->instance($class, $mock);
        $payload = $kind === 'document' ? ['maintenance_id' => $record, 'document_title' => 'Revoked upload'] : ['monthly_update_id' => $update];
        $this->post('/dd-phase3/ops/'.($kind === 'document' ? 'documents' : 'media'), $payload + ['file' => $this->file($kind)])->assertForbidden();
        $this->assertNotNull($path);
        $this->assertSame(0, DB::table('jairoads_next.maintenance_documents')->count());
        $this->assertSame(0, DB::table('jairoads_next.media')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    private function file(string $kind): UploadedFile
    {
        return $kind === 'document' ? UploadedFile::fake()->createWithContent('inspection.pdf', "%PDF-1.4\nDisposable inspection\n%%EOF")
            : UploadedFile::fake()->createWithContent('evidence.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='));
    }
}
