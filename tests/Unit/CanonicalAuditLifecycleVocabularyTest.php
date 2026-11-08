<?php

declare(strict_types=1);

use App\Services\ActivityNotifications;
use App\Services\AuditValues;

it('provides the existing notification verbs plus EngineerLGU lifecycle verbs', function (): void {
    foreach (['CREATE' => 'created', 'UPDATE' => 'updated', 'DELETE' => 'deleted',
        'ACTIVATE' => 'activated', 'DEACTIVATE' => 'deactivated'] as $action => $expected) {
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
