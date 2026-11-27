<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

beforeEach(function (): void {
    $this->f = $this->fixture('Engineer');
    $this->recordId = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
        $this->recordData($this->f['project'], $this->f['engineer'], 'Q4') + ['created_by' => $this->f['user']->canonical_user_account_id]
    );
    $this->report = function (string $month, string $modified, ?int $record = null): int {
        return (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record ?? $this->recordId, 'update_month' => $month,
            'progress_percentage' => 25, 'summary_of_text_reports' => 'Disposable report',
            'created_by' => $this->f['user']->canonical_user_account_id,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => $modified,
        ]);
    };
    $this->december = ($this->report)('2027-12', '2028-02-01 00:00:00');
    $this->january = ($this->report)('2026-01', '2028-01-01 00:00:00');
});

it('uses reporting months or modification time regardless of insertion order', function (string $sort, string $expected): void {
    $this->get('/workspace/ui/monthly-updates?sort='.$sort)->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.sort', $sort)
            ->where('updates.data.0.id', $this->$expected)->has('updates.data', 2));
})->with([['newest', 'december'], ['oldest', 'january'], ['modified', 'december']]);

it('moves an older report first after a subsequent modification', function (): void {
    DB::table('jairoads_next.monthly_updates')->where('id', $this->january)->update(['updated_at' => '2028-03-01 00:00:00']);
    $this->get('/workspace/ui/monthly-updates?sort=modified')->assertInertia(fn (Assert $page) => $page
        ->where('filters.sort', 'modified')->where('updates.data.0.id', $this->january));
});

it('falls back to newest for unsupported or structured sort input', function (mixed $sort): void {
    $this->get('/workspace/ui/monthly-updates?'.http_build_query(['sort' => $sort]))
        ->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.sort', 'newest')->where('updates.data.0.id', $this->december)
        ->where('updates.first_page_url', fn (string $url): bool => str_contains($url, 'sort=newest')));
})->with(['unsupported' => ['unexpected'], 'structured' => [['newest']]]);

it('uses the real varchar reporting month for year choices and filtering', function (string $year, string $expected): void {
    $column = DB::table('information_schema.columns')->where('table_schema', 'jairoads_next')
        ->where('table_name', 'monthly_updates')->where('column_name', 'update_month')->first();
    expect($column->data_type)->toBe('character varying')->and((int) $column->character_maximum_length)->toBe(7);
    $this->get('/workspace/ui/monthly-updates?year='.$year)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('filters.year', $year)->where('years', [2027, 2026])->has('updates.data', 1)->where('updates.data.0.id', $this->$expected));
    expect((int) DB::table('jairoads_next.maintenance_records')->value('maintenance_year'))->toBe(2026);
})->with([['2027', 'december'], ['2026', 'january']]);

it('combines project search year and sort without dropping pagination URLs', function (): void {
    $this->get('/workspace/ui/monthly-updates?'.http_build_query([
        'project' => (string) $this->f['project'], 'search' => 'Test project', 'year' => '2027', 'sort' => 'oldest',
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('filters', ['search' => 'Test project', 'project' => (string) $this->f['project'], 'year' => '2027', 'sort' => 'oldest'])
        ->has('updates.data', 1)->where('updates.data.0.id', $this->december)
        ->where('updates.first_page_url', fn (string $url): bool => str_contains($url, 'year=2027') && str_contains($url, 'sort=oldest') && str_contains($url, 'project=')));
    $this->get('/workspace/ui/monthly-updates?search=absent&year=2027')->assertInertia(fn (Assert $page) => $page->has('updates.data', 0));
});

it('uses a deterministic ID tie break across pagination', function (string $sort): void {
    for ($i = 0; $i < 13; $i++) {
        $id = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($this->f['project'], $this->f['engineer'], 'Q1', 2030 + $i) + ['created_by' => $this->f['user']->canonical_user_account_id]);
        ($this->report)('2027-12', '2028-01-01 00:00:00', (int) $id);
    }
    DB::table('jairoads_next.monthly_updates')->where('id', $this->january)->delete();
    // Equal primary values for all rows; each sort must still paginate consistently.
    DB::table('jairoads_next.monthly_updates')->update(['update_month' => '2027-12', 'updated_at' => '2028-01-01 00:00:00']);
    $expected = DB::table('jairoads_next.monthly_updates')->orderBy('id', $sort === 'oldest' ? 'asc' : 'desc')->pluck('id')->map(fn ($id): int => (int) $id)->all();
    foreach ([1, 2] as $number) {
        $this->get('/workspace/ui/monthly-updates?sort='.$sort.'&page='.$number)->assertInertia(fn (Assert $page) => $page
            ->where('updates.data', fn ($rows): bool => collect($rows)->pluck('id')->all() === array_slice($expected, ($number - 1) * 12, 12)));
    }
})->with(['newest', 'oldest', 'modified']);

it('includes cross-LGU reports in Engineer read filters while preserving explicit project filtering', function (): void {
    $otherRoad = $this->road();
    $otherProject = DB::table('jairoads_next.maintenance_projects')->insertGetId(['road_coverage_id' => $otherRoad, 'project_title' => 'Hidden project', 'created_by' => $this->f['user']->canonical_user_account_id]);
    $otherRecord = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData((int) $otherProject, $this->f['engineer']) + ['created_by' => $this->f['user']->canonical_user_account_id]);
    ($this->report)('2099-01', '2099-01-01 00:00:00', (int) $otherRecord);
    $this->get('/workspace/ui/monthly-updates?sort=modified')->assertInertia(fn (Assert $page) => $page->where('years', [2099, 2027, 2026])->has('updates.data', 3));
    $this->get('/workspace/ui/monthly-updates?year=2099&project='.$otherProject)->assertInertia(fn (Assert $page) => $page->where('years', [2099, 2027, 2026])->has('updates.data', 1));
});

it('lets Viewers read permitted reports but never mutate them', function (): void {
    $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'));
    $this->get('/workspace/ui/monthly-updates?year=2027&sort=newest')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('canWrite', false)->has('updates.data', 1)->where('updates.data.0.id', $this->december));
    $this->postJson('/workspace/ui/monthly-updates', ['maintenance_id' => $this->recordId, 'update_month' => '2029-01', 'progress_percentage' => 10])->assertForbidden();
    expect(DB::table('jairoads_next.monthly_updates')->count())->toBe(2);
});

it('handles supported zero-padded reporting years without casting the stored month', function (): void {
    $id = ($this->report)('0001-01', '2028-01-01 00:00:00');
    $this->get('/workspace/ui/monthly-updates?year=1')->assertInertia(fn (Assert $page) => $page
        ->where('years', [2027, 2026, 1])->where('filters.year', '1')->has('updates.data', 1)->where('updates.data.0.id', $id));
});

it('loads scoped monthly form choices on demand', function (): void {
    $other = $this->fixture('Engineer');
    $otherRecord = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
        $this->recordData($other['project'], $other['engineer']) + ['created_by' => $other['user']->canonical_user_account_id]
    );
    ($this->report)('2026-03', '2028-01-02 00:00:00', $otherRecord);
    $this->actingAs($this->f['user']);

    $this->get('/workspace/ui/monthly-updates/create')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('formChoicesUrl', '/workspace/ui/monthly-updates/form-choices')
            ->has('projects', 0)->has('records', 0)->has('existingUpdates', 0));
    $url = '/workspace/ui/monthly-updates/form-choices';
    $this->getJson($url)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->f['project']);
    $this->getJson($url.'?project='.$this->f['project'])->assertOk()->assertJsonPath('project.id', $this->f['project'])
        ->assertJsonCount(1, 'records')->assertJsonPath('records.0.id', $this->recordId)
        ->assertJsonCount(0, 'existingUpdates')->assertJsonPath('recordHasMore', false);
    $this->getJson($url.'?project='.$this->f['project'].'&record='.$this->recordId)
        ->assertOk()->assertJsonCount(2, 'existingUpdates')->assertJsonPath('selectedRecordId', $this->recordId);
    $this->getJson($url.'?project='.$this->f['project'].'&record='.$otherRecord)->assertNotFound();
    for ($year = 2030; $year < 2056; $year++) {
        DB::table('jairoads_next.maintenance_records')->insert(
            $this->recordData($this->f['project'], $this->f['engineer'], 'Q1', $year) + ['created_by' => $this->f['user']->canonical_user_account_id]
        );
    }
    $this->getJson($url.'?project='.$this->f['project'])->assertOk()
        ->assertJsonCount(25, 'records')->assertJsonPath('recordHasMore', true)->assertJsonCount(0, 'existingUpdates');
    $this->getJson($url.'?project='.$this->f['project'].'&record='.$this->recordId)->assertOk()
        ->assertJsonCount(26, 'records')->assertJsonCount(2, 'existingUpdates');
    $this->getJson($url.'?project='.$this->f['project'].'&record_page=2')->assertOk()
        ->assertJsonCount(2, 'records')->assertJsonPath('recordHasMore', false);
    $this->getJson($url.'?project='.$other['project'])->assertNotFound();
    $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'));
    $this->getJson($url)->assertForbidden();
});
