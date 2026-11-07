<?php

declare(strict_types=1);

use App\Services\RoleAccess;

it('keeps ordinary administrator permissions aligned with the final CRUD matrix', function (): void {
    foreach (['SuperAdmin', 'Admin'] as $role) {
        expect(RoleAccess::canManageAccounts($role))->toBeTrue();
        expect(RoleAccess::canDeleteOperations($role))->toBeTrue();
        expect(RoleAccess::canReadAuditLog($role))->toBeTrue();
        expect(RoleAccess::capabilities($role, false, false)['createRoads'])->toBeTrue();
        expect(RoleAccess::capabilities($role, false, false)['createUpdates'])->toBeTrue();
    }
});

it('allows engineers scoped operations only with an active linked identity and assignment', function (): void {
    expect(RoleAccess::canWriteOperations('Engineer'))->toBeTrue();
    expect(RoleAccess::canDeleteOperations('Engineer'))->toBeFalse();
    expect(RoleAccess::canManageAccounts('Engineer'))->toBeFalse();
    expect(RoleAccess::capabilities('Engineer', false, true)['createProjects'])->toBeFalse();
    expect(RoleAccess::capabilities('Engineer', true, false)['createProjects'])->toBeFalse();
    expect(RoleAccess::capabilities('Engineer', true, true)['createProjects'])->toBeTrue();
    expect(RoleAccess::capabilities('Engineer', false, true)['createRoads'])->toBeFalse();
    expect(RoleAccess::capabilities('Engineer', true, true)['createRoads'])->toBeTrue();
});

it('never grants viewer any business mutation', function (): void {
    expect(RoleAccess::canWriteOperations('Viewer'))->toBeFalse();
    expect(RoleAccess::canReadAuditLog('Viewer'))->toBeFalse();
    $caps = RoleAccess::capabilities('Viewer', true, false);
    expect($caps['readOnly'])->toBeTrue();
    foreach (['manageAccounts', 'createProjects', 'updateProjects', 'deleteProjects', 'createRoads', 'updateRoads', 'deleteRoads', 'createUpdates', 'createDocuments', 'manageLgus'] as $key) {
        expect($caps[$key])->toBeFalse();
    }
});
