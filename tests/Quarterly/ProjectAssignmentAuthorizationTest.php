<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

final class ProjectAssignmentAuthorizationTest extends PostgresTestCase
{
    public function test_eligible_engineer_can_open_and_submit_create_project_with_canonical_creator(): void
    {
        $engineer = $this->engineer();
        $this->account('Viewer'); // Ensure canonical account and Engineer IDs differ.
        $user = $this->account('Engineer', $engineer);
        $road = $this->road($engineer);
        $this->actingAs($user)->get('/dd-phase3/projects?view=create')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('dd-phase3/Operations')
                ->where('capabilities.createProjects', true)->where('capabilities.deleteProjects', false)->has('roads', 1));
        $this->postJson('/dd-phase3/ops/projects', [
            'project_title' => 'Engineer-created project', 'road_coverage_id' => $road,
            'created_by' => 999999, 'lgu_id' => 999999, 'assigned_engineer_id' => 999999,
        ])->assertRedirect();
        $project = DB::table('jairoads_next.maintenance_projects')->first();
        $this->assertNotSame($engineer, (int) $user->dd_user_account_id);
        $this->assertSame((int) $user->dd_user_account_id, (int) $project->created_by);
        $this->assertSame($road, (int) $project->road_coverage_id);
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Duplicate', 'road_coverage_id' => $road])->assertUnprocessable();
        $this->assertSame(1, DB::table('jairoads_next.maintenance_projects')->count());
        $this->assertDatabaseHas('jairoads_next.audit_logs', ['entity_type' => 'MaintenanceProject', 'entity_id' => $project->id, 'user_id' => $user->dd_user_account_id]);
    }

    public static function ineligibleProjectActors(): iterable
    {
        foreach (['Viewer', 'unlinked', 'inactive_account', 'retired', 'unassigned', 'inactive_assignment'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('ineligibleProjectActors')]
    public function test_ineligible_project_creator_is_rejected_without_mutation(string $case): void
    {
        $engineer = $this->engineer($case === 'retired' ? 'Retired' : 'Active');
        $user = $this->account($case === 'Viewer' ? 'Viewer' : 'Engineer', in_array($case, ['Viewer', 'unlinked'], true) ? null : $engineer, $case !== 'inactive_account');
        $road = $this->road($case === 'unassigned' ? null : $engineer);
        if ($case === 'inactive_assignment') {
            DB::table('jairoads_next.engineer_lgus')->update(['is_active' => false]);
        }
        $this->actingAs($user)->postJson('/dd-phase3/ops/projects', ['project_title' => 'Denied', 'road_coverage_id' => $road])->assertForbidden();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_projects')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_wrong_lgu_is_hidden_and_request_municipality_cannot_override_road_scope(): void
    {
        $engineer = $this->engineer();
        $user = $this->account('Engineer', $engineer);
        $ownRoad = $this->road($engineer);
        $otherRoad = $this->road();
        $ownLgu = DB::table('jairoads_next.road_coverages')->where('id', $ownRoad)->value('lgu_id');
        $this->actingAs($user)->get('/dd-phase3/projects?view=create')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('roads', 1)->where('roads.0.id', $ownRoad));
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Wrong municipality', 'road_coverage_id' => $otherRoad, 'lgu_id' => $ownLgu])->assertForbidden();
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Missing road', 'road_coverage_id' => 999999])->assertNotFound();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_projects')->count());
    }

    public static function administrators(): iterable
    {
        yield 'Admin' => ['Admin'];
        yield 'SuperAdmin' => ['SuperAdmin'];
    }

    #[DataProvider('administrators')]
    public function test_administrator_creates_an_empty_project_then_assigns_an_eligible_engineer(string $type): void
    {
        $admin = $this->account($type);
        $engineer = $this->engineer();
        $this->account('Engineer', $engineer);
        $road = $this->road($engineer);
        $this->actingAs($admin)->postJson('/dd-phase3/ops/projects', ['project_title' => 'Unassigned project', 'road_coverage_id' => $road])->assertRedirect();
        $project = DB::table('jairoads_next.maintenance_projects')->first();
        $this->assertSame((int) $admin->dd_user_account_id, (int) $project->created_by);
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->postJson('/dd-phase3/ops/records', $this->recordData((int) $project->id, $engineer) + ['created_by' => 999999, 'lgu_id' => 999999])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['project_id' => $project->id, 'managing_engineer_id' => $engineer, 'created_by' => $admin->dd_user_account_id]);
    }

    public static function ineligibleManagers(): iterable
    {
        foreach (['retired', 'inactive_account', 'unlinked_profile', 'wrong_lgu', 'inactive_assignment', 'other_admin', 'missing'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('ineligibleManagers')]
    public function test_invalid_manager_choice_is_rejected_and_absent_from_choices(string $case): void
    {
        $f = $this->fixture();
        $other = $this->engineer($case === 'retired' ? 'Retired' : 'Active');
        if (! in_array($case, ['unlinked_profile', 'missing'], true)) {
            $this->account($case === 'other_admin' ? 'Admin' : 'Engineer', $other, $case !== 'inactive_account');
        }
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        if ($case !== 'wrong_lgu') {
            DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $other, 'lgu_id' => $lgu, 'is_active' => $case !== 'inactive_assignment']);
        }
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('managerChoices', 1)->where('managerChoices.0.id', $f['engineer']));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $case === 'missing' ? 999999 : $other))->assertUnprocessable();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_admin_self_management_requires_real_active_profile_and_matching_assignment(): void
    {
        $f = $this->fixture('Admin', true);
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('managerChoices', 1)->where('managerChoices.0.id', $f['engineer']));
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = DB::table('jairoads_next.maintenance_records')->value('id');
        $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, ['description' => 'Admin own activity']))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => $f['engineer'], 'created_by' => $f['user']->dd_user_account_id, 'description' => 'Admin own activity']);
        DB::table('jairoads_next.engineer_lgus')->update(['is_active' => false]);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertUnprocessable();
    }

    public function test_unlinked_admin_retains_administrative_access_without_invented_self_identity(): void
    {
        $f = $this->fixture();
        $this->assertNull(app(DataDictionaryIdentityResolver::class)->resolve($f['user'])['engineer_id']);
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('managerChoices', 1)->where('managerChoices.0.id', $f['engineer']));
        $this->assertNull(DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->value('engineer_id'));
    }

    public function test_engineer_manages_only_own_records_and_never_assigns_or_deletes_for_others(): void
    {
        $f = $this->fixture('Engineer');
        $other = $this->engineer();
        $this->account('Engineer', $other);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $other, 'lgu_id' => $lgu, 'is_active' => true]);
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('managerChoices', 1)->where('managerChoices.0.id', $f['engineer']));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $other))->assertForbidden();
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = (int) DB::table('jairoads_next.maintenance_records')->where('quarter', 'Q1')->value('id');
        $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, ['description' => 'Own work']))->assertRedirect();
        $this->deleteJson('/dd-phase3/ops/records/'.$id)->assertForbidden();
        $this->deleteJson('/dd-phase3/ops/projects/'.$f['project'])->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Admin'));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $other, 'Q3'))->assertRedirect();
        $otherRecord = (int) DB::table('jairoads_next.maintenance_records')->where('quarter', 'Q3')->value('id');
        $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->putJson('/dd-phase3/ops/records/'.$otherRecord, $this->recordData($f['project'], $other, 'Q3'))->assertForbidden();
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_current_lgu_membership_is_required_even_for_previously_assigned_record(): void
    {
        $f = $this->fixture('Engineer');
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = DB::table('jairoads_next.maintenance_records')->value('id');
        DB::table('jairoads_next.engineer_lgus')->update(['is_active' => false]);
        $this->putJson('/dd-phase3/ops/records/'.$id, $data)->assertForbidden();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertForbidden();
    }

    #[DataProvider('administrators')]
    public function test_even_administrators_cannot_silently_reassign_existing_record(string $type): void
    {
        $f = $this->fixture($type);
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = DB::table('jairoads_next.maintenance_records')->value('id');
        $other = $this->engineer();
        $this->account('Engineer', $other);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $other, 'lgu_id' => $lgu, 'is_active' => true]);
        $before = DB::table('jairoads_next.audit_logs')->count();
        $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, ['managing_engineer_id' => $other]))->assertUnprocessable()->assertJsonValidationErrors('project_id');
        $this->assertSame($f['engineer'], (int) DB::table('jairoads_next.maintenance_records')->where('id', $id)->value('managing_engineer_id'));
        $this->assertSame($before, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_viewer_cannot_create_update_delete_or_receive_manager_choices(): void
    {
        $f = $this->fixture();
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = DB::table('jairoads_next.maintenance_records')->value('id');
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'))->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->has('managerChoices', 0)->where('capabilities.createProjects', false)->where('capabilities.updateProjects', false));
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Denied', 'road_coverage_id' => $f['road']])->assertForbidden();
        $this->postJson('/dd-phase3/ops/records', $data)->assertForbidden();
        $this->putJson('/dd-phase3/ops/records/'.$id, $data)->assertForbidden();
        $this->deleteJson('/dd-phase3/ops/records/'.$id)->assertForbidden();
    }

    public function test_inactive_or_retired_actor_cannot_continue_using_existing_session(): void
    {
        $f = $this->fixture('Engineer');
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertForbidden();
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => true]);
        DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['engineer_status' => 'Retired']);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertForbidden();
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
    }
}
