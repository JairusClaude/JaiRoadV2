<?php

declare(strict_types=1);

use App\Services\DataDictionary\DdActivityNotifications;

it('limits the provisional notification matrix to the documented business events', function () {
    foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
        foreach (['LGU', 'Engineer', 'EngineerLGU', 'UserAccount', 'RoadCoverage', 'MaintenanceProject'] as $entity) {
            foreach (['CREATE', 'UPDATE', 'DELETE', 'LOGIN'] as $action) {
                expect(DdActivityNotifications::qualifies($role, $action, $entity))->toBeFalse();
            }
        }
        expect(DdActivityNotifications::qualifies($role, 'DELETE', 'MaintenanceRecord'))->toBeFalse();
    }
    foreach (['Admin', 'SuperAdmin'] as $role) {
        expect(DdActivityNotifications::qualifies($role, 'UPDATE', 'MaintenanceRecord'))->toBeTrue();
        foreach (['MonthlyUpdate', 'MaintenanceDocument', 'Media'] as $entity) {
            foreach (['CREATE', 'UPDATE', 'DELETE'] as $action) {
                expect(DdActivityNotifications::qualifies($role, $action, $entity))->toBeTrue();
                expect(DdActivityNotifications::qualifies('Engineer', $action, $entity))->toBeFalse();
            }
        }
    }
    expect(DdActivityNotifications::qualifies('Engineer', 'CREATE', 'MaintenanceRecord'))->toBeTrue();
});
