<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('deletes a road with exactly one actor-attributed canonical audit event', function (): void {
    $fixture = $this->fixture('Admin');
    $roadId = $this->road($fixture['engineer']);
    $this->delete('/dd-phase3/ui/road-coverages/'.$roadId)->assertRedirect();

    $this->assertDatabaseMissing('jairoads_next.road_coverages', ['id' => $roadId]);
    $event = DB::table('jairoads_next.audit_logs')->where('entity_type', 'RoadCoverage')
        ->where('action', 'DELETE')->where('entity_id', $roadId)->sole();
    expect((int) $event->user_id)->toBe((int) $fixture['user']->dd_user_account_id);
    expect($event->old_value)->toContain('geometry_sha256');
});

it('blocks deletion of roads referenced by projects without recording a delete audit', function (): void {
    $fixture = $this->fixture('Admin');
    $this->delete('/dd-phase3/ui/road-coverages/'.$fixture['road'])
        ->assertSessionHasErrors('delete');
    $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $fixture['road']]);
    expect(DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count())->toBe(0);
});

it('validates all bulk IDs before removing any roads', function (): void {
    $fixture = $this->fixture('Admin');
    $road = $this->road($fixture['engineer']);
    $url = '/dd-phase3/ui/road-coverages/bulk';

    $this->deleteJson($url, ['ids' => [$road, $road]])->assertUnprocessable()->assertJsonValidationErrors('ids.1');
    $this->deleteJson($url, ['ids' => array_fill(0, 101, $road)])->assertUnprocessable()->assertJsonValidationErrors('ids');
    $this->deleteJson($url, ['ids' => [$road, 999999]])->assertNotFound();
    $this->deleteJson($url, ['ids' => [$road, $fixture['road']]])->assertUnprocessable()->assertJsonValidationErrors('delete');
    $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $road]);

    $other = $this->road($fixture['engineer']);
    $this->delete($url, ['ids' => [$road, $other]])->assertRedirect();
    $this->assertDatabaseMissing('jairoads_next.road_coverages', ['id' => $road]);
    $this->assertDatabaseMissing('jairoads_next.road_coverages', ['id' => $other]);
    expect(DB::table('jairoads_next.audit_logs')
        ->where('entity_type', 'RoadCoverage')->where('action', 'DELETE')->count())->toBe(2);
});

it('rolls back the road deletion when an audit event cannot be written', function (): void {
    $fixture = $this->fixture('Admin');
    $road = $this->road($fixture['engineer']);
    DB::unprepared(<<<'SQL'
CREATE FUNCTION jairoads_next.reject_road_delete_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.action = 'DELETE' AND NEW.entity_type = 'RoadCoverage' THEN
        RAISE EXCEPTION 'Disposable road deletion audit failure';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER reject_road_delete_audit BEFORE INSERT ON jairoads_next.audit_logs
FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_road_delete_audit();
SQL);
    $this->deleteJson('/dd-phase3/ui/road-coverages/'.$road)->assertServerError();
    $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $road]);
    expect(DB::table('jairoads_next.audit_logs')->where('entity_type', 'RoadCoverage')->count())->toBe(0);
});
