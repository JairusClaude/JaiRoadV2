<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\DdOperationsTestCase;

uses(DdOperationsTestCase::class);

it('renders each active DD role dashboard using its explicit identity', function (string $role, string $component) {
    $login = $this->linkedLogin($role);
    $destination = $role === 'SuperAdmin' ? '/dd-superadmin-landing' : '/dd-phase3/dashboard';
    $this->actingAs($login)->get('/dashboard')->assertRedirect($destination);
    $this->get($destination)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component($component)->missing('auth.user.password')->missing('auth.user.two_factor_secret'));
})->with([
    ['SuperAdmin', 'dd-superadmin-command-center/Index'],
    ['Admin', 'dd-phase3/Workspace'],
    ['Engineer', 'dd-phase3/RoleDashboard'],
    ['Viewer', 'dd-phase3/RoleDashboard'],
]);

it('denies direct SuperAdmin entry to other roles', function (string $role) {
    $this->actingAs($this->linkedLogin($role))->get('/dd-superadmin-landing')->assertForbidden();
})->with(['Admin', 'Engineer', 'Viewer']);

it('keeps account management private to administrative roles', function (string $role) {
    $this->actingAs($this->linkedLogin($role))->get('/dd-phase3/users')->assertForbidden();
    $this->postJson('/dd-phase3/accounts', [])->assertForbidden();
})->with(['Engineer', 'Viewer']);

it('denies Viewer mutations through direct HTTP requests', function () {
    $this->actingAs($this->linkedLogin('Viewer'));
    foreach (['roads', 'projects', 'records', 'updates', 'documents', 'media'] as $entity) {
        $this->postJson('/dd-phase3/ops/'.$entity, [])->assertForbidden();
    }
    foreach (['roads', 'projects', 'records', 'updates'] as $entity) {
        $this->putJson('/dd-phase3/ops/'.$entity.'/1', [])->assertForbidden();
        $this->deleteJson('/dd-phase3/ops/'.$entity.'/1')->assertForbidden();
    }
    $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
});

it('revokes protected dashboard and mutation access for existing inactive sessions', function (string $role) {
    $login = $this->linkedLogin($role);
    $this->actingAs($login)->get('/dashboard')->assertRedirect();
    DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['is_active' => false]);
    $this->get('/dashboard')->assertForbidden();
    $this->postJson('/dd-phase3/ops/projects', [])->assertForbidden();
    $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
})->with(['SuperAdmin', 'Admin', 'Engineer', 'Viewer']);

it('requires current ManagingEngineer and active LGU assignment for record edits', function () {
    $login = $this->linkedLogin('Engineer');
    $own = $this->record($login->dd_user_account_id);
    $other = $this->record($login->dd_user_account_id, 99);
    $outside = $this->record($login->dd_user_account_id, 88, 18);
    $this->actingAs($login)->put('/dd-phase3/ops/records/'.$own, $this->recordPayload($own))->assertRedirect('/dd-phase3/projects?view=show&project='.DB::table('jairoads_next.maintenance_records')->where('id', $own)->value('project_id'));
    $this->putJson('/dd-phase3/ops/records/'.$other, $this->recordPayload($other))->assertForbidden();
    $this->putJson('/dd-phase3/ops/records/'.$outside, $this->recordPayload($outside))->assertForbidden();
    $this->deleteJson('/dd-phase3/ops/records/'.$own)->assertForbidden();
    DB::table('jairoads_next.engineer_lgus')->where('engineer_id', 88)->update(['is_active' => false]);
    $this->putJson('/dd-phase3/ops/records/'.$own, $this->recordPayload($own))->assertForbidden();
    $this->assertSame(88, DB::table('jairoads_next.maintenance_records')->where('id', $own)->value('managing_engineer_id'));
});

it('allows administrative corrections without silently reassigning the ManagingEngineer', function (string $role) {
    $login = $this->linkedLogin($role);
    $record = $this->record($login->dd_user_account_id, 99, 18);
    $this->actingAs($login)->put('/dd-phase3/ops/records/'.$record, $this->recordPayload($record))->assertRedirect('/dd-phase3/projects?view=show&project='.DB::table('jairoads_next.maintenance_records')->where('id', $record)->value('project_id'));
    DB::table('jairoads_next.engineers')->insert(['id' => 100, 'engineer_status' => 'Active']);
    $this->putJson('/dd-phase3/ops/records/'.$record, [...$this->recordPayload($record), 'managing_engineer_id' => 100])
        ->assertUnprocessable()->assertJsonValidationErrors('project_id');
    $this->assertSame(99, DB::table('jairoads_next.maintenance_records')->where('id', $record)->value('managing_engineer_id'));
})->with(['SuperAdmin', 'Admin']);

it('attributes project creation to the authenticated UserAccount and preserves secret-free audit evidence', function (string $role) {
    $login = $this->linkedLogin($role);
    $road = $this->road();
    $this->actingAs($login)->post('/dd-phase3/ops/projects', [
        'project_title' => 'Authorized project', 'road_coverage_id' => $road,
        'created_by' => 98765, 'status' => 'Completed',
    ])->assertRedirect('/dd-phase3/projects');
    $project = DB::table('jairoads_next.maintenance_projects')->first();
    $event = DB::table('jairoads_next.audit_logs')->whereNull('recipient_user_id')->first();
    $this->assertSame((int) $login->dd_user_account_id, $project->created_by);
    $this->assertSame((int) $login->dd_user_account_id, $event->user_id);
    $this->assertSame('DD-UserAccount#'.$login->dd_user_account_id, $event->actor_identifier);
    $this->assertSame('MaintenanceProject', $event->entity_type);
    $this->assertSame($project->id, $event->entity_id);
    $this->assertStringNotContainsString($login->password, json_encode($event));
    $this->assertArrayNotHasKey('status', (array) $project);
})->with(['SuperAdmin', 'Admin', 'Engineer']);

it('rolls a business mutation back when its audit insert fails', function () {
    $login = $this->linkedLogin('Admin');
    $road = $this->road();
    DB::unprepared("CREATE FUNCTION jairoads_next.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit unavailable'; END; $$; CREATE TRIGGER fail_audit BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.fail_audit()");
    $this->actingAs($login)->postJson('/dd-phase3/ops/projects', ['project_title' => 'Must roll back', 'road_coverage_id' => $road])->assertServerError();
    $this->assertSame(0, DB::table('jairoads_next.maintenance_projects')->count());
    $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
});

it('rehearses the additive append-only proposal without changing historical actors', function () {
    $login = $this->linkedLogin('Admin');
    DB::table('jairoads_next.audit_logs')->insert([
        'user_id' => $login->dd_user_account_id, 'actor_identifier' => 'Retained actor', 'action' => 'CREATE',
    ]);
    DB::unprepared(file_get_contents(base_path('tests/Fixtures/password-append-only.sql')));
    foreach (["UPDATE jairoads_next.audit_logs SET actor_identifier = 'Altered'", 'DELETE FROM jairoads_next.audit_logs', 'TRUNCATE jairoads_next.audit_logs'] as $sql) {
        try {
            DB::statement($sql);
            $this->fail('Audit history mutation was allowed.');
        } catch (QueryException $exception) {
            $this->assertSame('55000', $exception->errorInfo[0]);
        }
    }
    DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['is_active' => false, 'username' => 'renamed']);
    $this->assertSame('Retained actor', DB::table('jairoads_next.audit_logs')->value('actor_identifier'));
    $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
});
