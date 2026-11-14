<?php

declare(strict_types=1);

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

beforeEach(function (): void {
    $this->f = $this->fixture('Engineer');
    $this->lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $this->f['road'])->value('lgu_id');
    $this->recordPayload = function (): array {
        $data = $this->recordData($this->f['project'], $this->f['engineer'], 'Q2');
        unset($data['managing_engineer_id']);

        return $data + ['engineers_id' => (string) $this->f['engineer']];
    };
    $this->roadPayload = fn (): array => ['road_name' => 'Contract road', 'lgus_id' => (string) $this->lgu,
        'kilometers' => '2.50', 'pavement_type' => 'Concrete', 'state_category' => 'Good',
        'geojson' => ['type' => 'LineString', 'coordinates' => [[125, 7], [125.1, 7.1]]]];
    $this->record = function (): int {
        return (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($this->f['project'], $this->f['engineer'], 'Q2') + ['created_by' => $this->f['user']->dd_user_account_id]
        );
    };
});

it('maps RoadCoverage municipality on create and edit and preserves server attribution', function (): void {
    $this->post('/dd-phase3/ui/road-coverages', ($this->roadPayload)() + ['created_by' => 999999])->assertSessionHasNoErrors()->assertRedirect();
    $row = DB::table('jairoads_next.road_coverages')->where('road_name', 'Contract road')->first();
    expect((int) $row->lgu_id)->toBe($this->lgu)->and((int) $row->created_by)->toBe($this->f['engineer']);
    $url = '/dd-phase3/ui/road-coverages/'.$row->id;
    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('coverage.lgus_id', $this->lgu)
        ->where('coverage.lgu.id', $this->lgu)->where('coverage.created_by', $this->f['engineer']));
    $payload = ($this->roadPayload)();
    unset($payload['geojson']);
    $this->put($url, array_replace($payload, ['state_category' => 'Fair', 'lgu_id' => $this->lgu, 'created_by' => 999999]))->assertSessionHasNoErrors();
    $after = DB::table('jairoads_next.road_coverages')->where('id', $row->id)->first();
    expect($after->geojson)->toBe($row->geojson)->and((int) $after->lgu_id)->toBe($this->lgu)
        ->and((int) $after->created_by)->toBe($this->f['engineer'])->and($after->state_category)->toBe('Fair');
});

it('keeps project municipality inherited and creator IDs server controlled on create and edit', function (): void {
    $road = $this->road($this->f['engineer']);
    $data = ['road_coverage_id' => $road, 'project_title' => 'Contract project', 'description' => 'Initial', 'lgu_id' => 999999, 'created_by' => 999999];
    $this->post('/dd-phase3/ui/maintenance-projects', $data)->assertSessionHasNoErrors();
    $project = DB::table('jairoads_next.maintenance_projects')->where('road_coverage_id', $road)->first();
    expect((int) $project->created_by)->toBe((int) $this->f['user']->dd_user_account_id);
    $url = '/dd-phase3/ui/maintenance-projects/'.$project->id;
    $this->put($url, array_replace($data, ['description' => 'Edited']))->assertSessionHasNoErrors();
    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('project.road_coverage_id', $road)
        ->where('project.description', 'Edited')->where('project.municipality', 'Test municipality')
        ->where('project.created_by', DB::table('jairoads_next.user_accounts')->where('id', $this->f['user']->dd_user_account_id)->value('username')));
    expect(DB::table('jairoads_next.maintenance_projects')->where('id', $project->id)->value('created_by'))->toBe($project->created_by);
});

it('maps ManagingEngineer and quarterly year without confusing manager creator or route parent', function (): void {
    $url = '/dd-phase3/ui/maintenance-projects/'.$this->f['project'].'/records';
    $data = ($this->recordPayload)() + ['created_by' => 999999];
    $this->post($url, array_replace($data, ['project_id' => 999999]))->assertSessionHasNoErrors();
    $row = DB::table('jairoads_next.maintenance_records')->first();
    expect((int) $row->project_id)->toBe($this->f['project'])->and((int) $row->managing_engineer_id)->toBe($this->f['engineer'])
        ->and((int) $row->created_by)->toBe((int) $this->f['user']->dd_user_account_id)->and((int) $row->maintenance_year)->toBe(2026)->and($row->quarter)->toBe('Q2');
    $this->put($url.'/'.$row->id, array_replace($data, ['estimated_duration_days' => 9]))->assertSessionHasNoErrors();
    $this->get($url.'/'.$row->id)->assertInertia(fn (Assert $page) => $page->where('record.year', 2026)
        ->where('record.engineers_id', $this->f['engineer'])->where('record.managing_engineer.id', $this->f['engineer'])
        ->where('record.estimated_duration_days', 9)->where('record.quarter', 'Q2'));
});

it('rejects contradictory or structured aliases before a business mutation', function (string $workflow, mixed $other): void {
    if ($workflow === 'road') {
        $url = '/dd-phase3/ui/road-coverages';
        $data = ($this->roadPayload)() + ['lgu_id' => $other];
        $field = 'lgus_id';
    } else {
        $url = '/dd-phase3/ui/maintenance-projects/'.$this->f['project'].'/records';
        $data = ($this->recordPayload)() + ['managing_engineer_id' => $other];
        $field = 'engineers_id';
    }
    $this->postJson($url, $data)->assertUnprocessable()->assertJsonValidationErrors($field);
    expect(DB::table('jairoads_next.road_coverages')->count())->toBe(1)
        ->and(DB::table('jairoads_next.maintenance_records')->count())->toBe(0)
        ->and(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
})->with([['road', 999999], ['road', [1]], ['record', 999999], ['record', [1]]]);

it('keeps equivalent duplicate IDs compatible while canonical operations use canonical names', function (): void {
    $data = ($this->recordPayload)();
    $this->post('/dd-phase3/ui/maintenance-projects/'.$this->f['project'].'/records', $data + ['managing_engineer_id' => $this->f['engineer']])->assertSessionHasNoErrors();
    $this->post('/dd-phase3/ops/records', $this->recordData($this->f['project'], $this->f['engineer'], 'Q4'))->assertSessionHasNoErrors();
    expect(DB::table('jairoads_next.maintenance_records')->orderBy('quarter')->pluck('quarter')->all())->toBe(['Q2', 'Q4']);
});

it('keeps manager selection authorization and canonical actor attribution behind the alias adapter', function (): void {
    $url = '/dd-phase3/ui/maintenance-projects/'.$this->f['project'].'/records';
    $this->postJson($url, array_replace(($this->recordPayload)(), ['engineers_id' => $this->engineer()]))->assertForbidden();
    expect(DB::table('jairoads_next.maintenance_records')->count())->toBe(0);
    $admin = $this->account('Admin');
    $this->withSession(['password_hash_web' => null])->actingAs($admin);
    $this->post($url, ($this->recordPayload)() + ['created_by' => 999999])->assertSessionHasNoErrors();
    $row = DB::table('jairoads_next.maintenance_records')->first();
    expect((int) $row->created_by)->toBe((int) $admin->dd_user_account_id)
        ->and((int) $row->managing_engineer_id)->toBe($this->f['engineer']);
});

it('returns alias validation errors under the actual HTML form fields', function (): void {
    $road = ($this->roadPayload)();
    unset($road['lgus_id']);
    $this->post('/dd-phase3/ui/road-coverages', $road)->assertSessionHasErrors('lgus_id')->assertSessionDoesntHaveErrors('lgu_id');
    $record = ($this->recordPayload)();
    unset($record['engineers_id']);
    $this->post('/dd-phase3/ui/maintenance-projects/'.$this->f['project'].'/records', $record)->assertSessionHasErrors('engineers_id')->assertSessionDoesntHaveErrors('managing_engineer_id');
    expect(DB::table('jairoads_next.maintenance_records')->count())->toBe(0);
});

it('keeps a reporting month independent of the quarterly year and rejects missing canonical year', function (): void {
    $record = ($this->record)();
    $this->post('/dd-phase3/ui/monthly-updates', ['maintenance_id' => $record, 'project_id' => 999999,
        'update_month' => '2027-12', 'progress_percentage' => '33.50', 'created_by' => 999999])->assertSessionHasNoErrors();
    $row = DB::table('jairoads_next.monthly_updates')->first();
    expect($row->update_month)->toBe('2027-12')->and((int) $row->created_by)->toBe((int) $this->f['user']->dd_user_account_id);
    $this->get('/dd-phase3/ui/monthly-updates?year=2027')->assertInertia(fn (Assert $page) => $page
        ->where('updates.data.0.update_month', '2027-12')->where('updates.data.0.record.year', 2026));
    $data = ($this->recordPayload)();
    unset($data['maintenance_year']);
    $this->postJson('/dd-phase3/ui/maintenance-projects/'.$this->f['project'].'/records', $data + ['year' => 2027])
        ->assertUnprocessable()->assertJsonValidationErrors('maintenance_year');
});

it('maps document attachment errors and prevents client ownership or private-path injection', function (): void {
    $record = ($this->record)();
    $data = ['maintenance_id' => $record, 'document_title' => 'Contract document', 'uploaded_by' => 999999,
        'file_path' => 'public/forged.pdf', 'file_name' => 'forged.pdf'];
    $this->post('/dd-phase3/ui/maintenance-documents', $data)->assertSessionHasErrors('attachment')->assertSessionDoesntHaveErrors('file');
    $this->get('/dd-phase3/ui/maintenance-documents/create')->assertOk();
    $this->postJson('/dd-phase3/ui/maintenance-documents', $data + ['attachment' => 'not-an-upload'])
        ->assertUnprocessable()->assertJsonValidationErrors('attachment');
    config(['jairoads_documents.supabase_url' => 'http://127.0.0.1:5799', 'jairoads_documents.service_role_key' => 'disposable-mock-only']);
    Http::preventStrayRequests();
    Http::fake(['http://127.0.0.1:5799/*' => Http::response('', 200)]);
    $this->post('/dd-phase3/ui/maintenance-documents', $data + ['attachment' => UploadedFile::fake()->createWithContent('actual.pdf', "%PDF-1.4\nDisposable\n%%EOF")])->assertSessionHasNoErrors();
    $doc = DB::table('jairoads_next.maintenance_documents')->first();
    expect((int) $doc->uploaded_by)->toBe((int) $this->f['user']->dd_user_account_id)->and($doc->file_name)->toBe('actual.pdf')
        ->and($doc->file_path)->toStartWith('maintenance-records/'.$record.'/');
    $this->put('/dd-phase3/ui/maintenance-documents/'.$doc->id, ['document_title' => 'Edited', 'maintenance_id' => 999999, 'uploaded_by' => 999999])->assertSessionHasNoErrors();
    expect((int) DB::table('jairoads_next.maintenance_documents')->where('id', $doc->id)->value('maintenance_id'))->toBe($record);
    $this->get('/dd-phase3/ui/maintenance-documents/'.$doc->id)->assertInertia(fn (Assert $page) => $page
        ->missing('document.file_path')->where('document.file_name', 'actual.pdf')->where('document.document_title', 'Edited'));
});

it('takes media parent from the route and uploader MIME and private path from the server', function (): void {
    $record = ($this->record)();
    $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2027-12', 'progress_percentage' => 10, 'created_by' => $this->f['user']->dd_user_account_id]);
    config(['jairoads_monthly_updates.supabase_url' => 'http://127.0.0.1:5799', 'jairoads_monthly_updates.service_role_key' => 'disposable-mock-only']);
    Http::preventStrayRequests();
    Http::fake(['http://127.0.0.1:5799/*' => Http::response('', 200)]);
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZsGQAAAAASUVORK5CYII=');
    $this->post('/dd-phase3/ui/monthly-updates/'.$update.'/media', ['monthly_update_id' => 999999, 'uploaded_by' => 999999,
        'file_path' => 'public/forged', 'file_type' => 'video/mp4', 'file' => UploadedFile::fake()->createWithContent('actual.png', $png)])->assertSessionHasNoErrors();
    $media = DB::table('jairoads_next.media')->first();
    expect((int) $media->monthly_update_id)->toBe((int) $update)->and((int) $media->uploaded_by)->toBe((int) $this->f['user']->dd_user_account_id)
        ->and($media->file_type)->toBe('image/png')->and($media->file_path)->toStartWith('monthly-updates/'.$update.'/');
    $this->get('/dd-phase3/ui/monthly-updates/'.$update)->assertInertia(fn (Assert $page) => $page
        ->where('media.0.mime_type', 'image/png')->where('media.0.file_name', 'actual.png')->missing('media.0.file_path')->missing('media.0.uploaded_by'));
});
