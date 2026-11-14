<?php

declare(strict_types=1);

use App\Services\ActivityNotifications;

it('addresses at most one proposed eligible maintenance assignee and never broadcasts', function (): void {
    foreach (['Admin', 'SuperAdmin'] as $role) {
        foreach (['CREATE', 'UPDATE', 'REASSIGN'] as $action) {
            expect(ActivityNotifications::eligibleEvent($role, $action, 'MaintenanceRecord'))->toBeTrue();
        }
        foreach (['MonthlyUpdate', 'MaintenanceDocument', 'Media'] as $entity) {
            foreach (['CREATE', 'UPDATE', 'DELETE'] as $action) {
                expect(ActivityNotifications::eligibleEvent($role, $action, $entity))->toBeTrue();
            }
        }
        expect(ActivityNotifications::eligibleEvent($role, 'DELETE', 'MaintenanceRecord'))->toBeFalse();
        expect(ActivityNotifications::eligibleEvent($role, 'UPDATE', 'UserAccount'))->toBeFalse();
        expect(ActivityNotifications::eligibleEvent($role, 'ACTIVATE', 'EngineerLGU'))->toBeFalse();
    }
    foreach (['Engineer', 'Viewer', 'Unknown'] as $role) {
        expect(ActivityNotifications::eligibleEvent($role, 'CREATE', 'MaintenanceRecord'))->toBeFalse();
        expect(ActivityNotifications::eligibleEvent($role, 'UPDATE', 'MonthlyUpdate'))->toBeFalse();
    }
});
