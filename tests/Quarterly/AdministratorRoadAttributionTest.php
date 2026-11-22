<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('requires explicit active Engineer attribution for administrator-created roads', function (string $role): void {
    $fixture = $this->fixture($role);
    $road = DB::table('jairoads_next.road_coverages')->where('id', $fixture['road'])->first();
    $payload = [
        'road_name' => 'Explicitly attributed mapped road',
        'lgus_id' => $road->lgu_id,
        'kilometers' => 1,
        'pavement_type' => 'Concrete',
        'state_category' => 'Good',
        'geojson' => json_decode($road->geojson, true),
    ];
    $this->get('/dd-phase3/ui/road-coverages/create')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('requiresCreator', true)->has('roadCreatorChoices'));

    $before = DB::table('jairoads_next.road_coverages')->count();
    $this->postJson('/dd-phase3/ui/road-coverages', $payload)->assertUnprocessable()
        ->assertJsonValidationErrors('created_by_engineer_id');
    $this->assertSame($before, DB::table('jairoads_next.road_coverages')->count());

    $this->postJson('/dd-phase3/ui/road-coverages', $payload + [
        'created_by_engineer_id' => $fixture['engineer'],
    ])->assertRedirect();
    $created = DB::table('jairoads_next.road_coverages')
        ->where('road_name', 'Explicitly attributed mapped road')->sole();
    $this->assertSame($fixture['engineer'], (int) $created->created_by);
    $this->assertDatabaseHas('jairoads_next.audit_logs', [
        'entity_type' => 'RoadCoverage',
        'entity_id' => $created->id,
        'user_id' => $fixture['user']->dd_user_account_id,
    ]);
})->with(['Admin', 'SuperAdmin']);
