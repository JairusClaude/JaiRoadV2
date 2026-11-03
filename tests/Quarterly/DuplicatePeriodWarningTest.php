<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\DuplicateMaintenancePeriod;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

final class DuplicatePeriodWarningTest extends PostgresTestCase
{
    public function test_duplicate_redirect_provides_verified_warning_and_preserves_inputs_without_audit(): void
    {
        $f = $this->fixture('Engineer');
        $data = $this->formData($f['project'], $f['engineer']);
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records';
        $this->postJson($url, $data)->assertRedirect();
        $existing = (int) DB::table('jairoads_next.maintenance_records')->value('id');
        $history = DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();

        $this->from($url.'/create')->post($url, array_replace($data, ['description' => 'Keep my work']))
            ->assertRedirect($url.'/create')->assertSessionHasErrors('quarter')
            ->assertSessionHasInput('description', 'Keep my work');
        $this->get($url.'/create')->assertInertia(fn (Assert $page) => $page
            ->where('duplicatePeriod.project_id', $f['project'])->where('duplicatePeriod.project_title', 'Test project')
            ->where('duplicatePeriod.maintenance_year', 2026)->where('duplicatePeriod.quarter', 'Q1')
            ->where('duplicatePeriod.details_url', $url.'/'.$existing)
            ->where('records.0.details_url', $url.'/'.$existing));
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame($history, DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson());
    }

    public function test_another_engineer_cannot_bypass_the_project_period_rule(): void
    {
        $f = $this->fixture('Engineer');
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records';
        $this->postJson($url, $this->formData($f['project'], $f['engineer']))->assertRedirect();
        $other = $this->engineer();
        $otherUser = $this->account('Engineer', $other);
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $other,
            'lgu_id' => DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id'), 'is_active' => true]);
        $count = DB::table('jairoads_next.audit_logs')->count();
        $this->flushSession();
        $this->actingAs($otherUser)->postJson($url, $this->formData($f['project'], $other))
            ->assertUnprocessable()->assertJsonValidationErrors('quarter');
        $this->get($url.'/create')->assertInertia(fn (Assert $page) => $page->where('duplicatePeriod', null));
        $this->assertSame($count, DB::table('jairoads_next.audit_logs')->count());
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
        $this->postJson($url, $this->formData($f['project'], $other, 'Q1', 2027))->assertRedirect();
    }

    public function test_warning_and_links_do_not_survive_loss_of_authorized_lgu_scope(): void
    {
        $f = $this->fixture('Engineer');
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records';
        $data = $this->formData($f['project'], $f['engineer']);
        $this->postJson($url, $data)->assertRedirect();
        $this->from($url.'/create')->post($url, $data)->assertSessionHasErrors('quarter');
        $oldLgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('lgu_id', $oldLgu)->update(['is_active' => false]);
        $road = $this->road($f['engineer']);
        $otherProject = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId(['project_title' => 'Other authorized project', 'road_coverage_id' => $road, 'created_by' => $f['user']->dd_user_account_id]);
        $this->get('/dd-phase3/ui/maintenance-records/create')->assertInertia(fn (Assert $page) => $page
            ->where('duplicatePeriod', null)->has('records', 0)->has('projects', 1)
            ->where('projects.0.id', $otherProject));
        $this->get($url.'/1')->assertNotFound();
        $this->flushSession();
        $this->actingAs($this->account('Viewer'))->postJson($url, $data)->assertForbidden();
    }

    public function test_warning_never_fabricates_a_details_link_for_an_unavailable_record(): void
    {
        $f = $this->fixture();
        $this->withSession(['dd_duplicate_period' => ['project_id' => $f['project'], 'maintenance_year' => 2026, 'quarter' => 'Q1']])
            ->get('/dd-phase3/ui/maintenance-records/create')->assertInertia(fn (Assert $page) => $page
            ->where('duplicatePeriod.details_url', null));
    }

    /** @return array<string,int|string|null> */
    private function formData(int $project, int $engineer, string $quarter = 'Q1', int $year = 2026): array
    {
        $data = $this->recordData($project, $engineer, $quarter, $year);
        $data['engineers_id'] = $data['managing_engineer_id'];
        unset($data['managing_engineer_id']);

        return $data;
    }

    private function databaseError(string $sql, string $state, string $constraint): QueryException
    {
        $previous = new \PDOException('disposable simulated database violation');
        $previous->errorInfo = [$state, 7, 'duplicate key value violates unique constraint "'.$constraint.'"'];

        return new QueryException('pgsql', $sql, [], $previous);
    }

    public function test_future_unique_constraint_detection_requires_the_exact_catalog_verified_key(): void
    {
        $error = $this->databaseError('insert into "jairoads_next"."maintenance_records" ("project_id") values (?)', '23505', 'owner_period_key');
        $manager = DB::getFacadeRoot();
        try {
            DB::shouldReceive('selectOne')->once()->withArgs(fn (string $sql, array $bindings): bool => str_contains($sql, "ARRAY['maintenance_year', 'project_id', 'quarter']") && $bindings === ['owner_period_key'])
                ->andReturn((object) ['indexrelid' => 123]);
            $this->assertTrue(DuplicateMaintenancePeriod::matchesDatabaseConstraint($error));
        } finally {
            DB::swap($manager);
        }
        // The actual disposable catalog has a primary key, not a period UNIQUE.
        $this->assertFalse(DuplicateMaintenancePeriod::matchesDatabaseConstraint($this->databaseError($error->getSql(), '23505', 'maintenance_records_pkey')));
        $this->assertFalse(DuplicateMaintenancePeriod::matchesDatabaseConstraint($this->databaseError($error->getSql(), '23503', 'owner_period_key')));
        $this->assertFalse(DuplicateMaintenancePeriod::matchesDatabaseConstraint($this->databaseError('insert into "jairoads_next"."audit_logs" ("id") values (?)', '23505', 'owner_period_key')));
    }

    public function test_unrelated_audit_database_failure_rolls_back_and_is_not_a_period_conflict(): void
    {
        $f = $this->fixture();
        DB::listen(function ($query): void {
            if (str_starts_with($query->sql, 'insert into "jairoads_next"."audit_logs"')) {
                throw $this->databaseError($query->sql, '23505', 'audit_logs_pkey');
            }
        });
        $this->withoutExceptionHandling();
        try {
            $this->postJson('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records', $this->formData($f['project'], $f['engineer']));
            $this->fail('Unrelated database failures must propagate.');
        } catch (QueryException $error) {
            $this->assertStringContainsString('audit_logs', $error->getSql());
        }
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }
}
