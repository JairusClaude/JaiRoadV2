<?php

declare(strict_types=1);

use App\Services\ActivityNotifications;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

uses(TestCase::class);

it('normalizes database availability booleans without treating the false string as true', function (): void {
    DB::shouldReceive('selectOne')
        ->twice()
        ->with('SELECT to_regclass(?) IS NOT NULL AS available', [ActivityNotifications::TABLE])
        ->andReturn((object) ['available' => 't'], (object) ['available' => 'f']);

    expect(app(ActivityNotifications::class)->available())->toBeTrue();
    expect(app(ActivityNotifications::class)->available())->toBeFalse();
});
