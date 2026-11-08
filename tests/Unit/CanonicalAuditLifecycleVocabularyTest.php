<?php

declare(strict_types=1);

use App\Services\ActivityNotifications;
use App\Services\AuditValues;

it('provides the existing notification verbs plus EngineerLGU lifecycle verbs', function (): void {
    foreach (['CREATE' => 'created', 'UPDATE' => 'updated', 'DELETE' => 'deleted',
        'ACTIVATE' => 'activated', 'DEACTIVATE' => 'deactivated',
        'REASSIGN' => 'reassigned', 'RETIRE' => 'retired'] as $action => $expected) {
        expect(ActivityNotifications::verbForAction($action))->toBe($expected);
    }

    expect(fn () => ActivityNotifications::verbForAction('LOGIN'))->toThrow(InvalidArgumentException::class);
});

it('keeps EngineerLGU identity stable and records only changed status snapshots', function (): void {
    $values = new AuditValues;
    $id = ['engineer_id' => 7, 'lgu_id' => 11];
    foreach ([false, true] as $beforeActive) {
        [$before, $after] = $values->changes('EngineerLGU',
            $id + ['is_active' => $beforeActive],
            $id + ['is_active' => ! $beforeActive]);
        expect($before)->toBe(['is_active' => $beforeActive]);
        expect($after)->toBe(['is_active' => ! $beforeActive]);
    }
    [$before, $after] = $values->changes('EngineerLGU',
        $id + ['is_active' => true], $id + ['is_active' => true]);
    expect($before)->toBe([]);
    expect($after)->toBe([]);
});

it('preserves nullable manager transitions for explicit unassignment', function (): void {
    $values = new AuditValues;
    [$before, $after] = $values->changes('MaintenanceRecord', ['managing_engineer_id' => 7], ['managing_engineer_id' => null]);
    expect($before)->toBe(['managing_engineer_id' => 7]);
    expect($after)->toBe(['managing_engineer_id' => null]);
});
