<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('counts only active Engineer LGU assignments while keeping all municipalities available', function (): void {
    $fixture = $this->fixture('Engineer');
    $this->get('/dd-phase3/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('stats.assignedLgus', 1)->where('stats.lgus', 1)->has('assignedLgus', 1));

    $this->road($fixture['engineer']);
    $this->get('/dd-phase3/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('stats.assignedLgus', 2)->where('stats.lgus', 2)->has('assignedLgus', 2));

    $lastAssigned = DB::table('jairoads_next.engineer_lgus')
        ->where('engineer_id', $fixture['engineer'])->max('lgu_id');
    DB::table('jairoads_next.engineer_lgus')
        ->where('engineer_id', $fixture['engineer'])->where('lgu_id', $lastAssigned)
        ->update(['is_active' => false]);
    $this->get('/dd-phase3/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('stats.assignedLgus', 1)->where('stats.lgus', 2)->has('assignedLgus', 2));
});
