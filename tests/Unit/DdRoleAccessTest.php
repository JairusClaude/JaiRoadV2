<?php

declare(strict_types=1);

use App\Services\DataDictionary\DdRoleAccess;

it('keeps ordinary administrator permissions aligned with the final CRUD matrix', function (): void {
    foreach (['SuperAdmin', 'Admin'] as $role) {
        expect(DdRoleAccess::canManageAccounts($role))->toBeTrue();
        expect(DdRoleAccess::canDeleteOperations($role))->toBeTrue();
        expect(DdRoleAccess::canReadAuditLog($role))->toBeTrue();
        expect(DdRoleAccess::capabilities($role, false, false)['createRoads'])->toBeTrue();
        expect(DdRoleAccess::capabilities($role, false, false)['createUpdates'])->toBeTrue();
    }
});

it('allows engineers scoped operations only with an active linked identity and assignment', function (): void {
    expect(DdRoleAccess::canWriteOperations('Engineer'))->toBeTrue();
    expect(DdRoleAccess::canDeleteOperations('Engineer'))->toBeFalse();
    expect(DdRoleAccess::canManageAccounts('Engineer'))->toBeFalse();
    expect(DdRoleAccess::capabilities('Engineer', false, true)['createProjects'])->toBeFalse();
    expect(DdRoleAccess::capabilities('Engineer', true, false)['createProjects'])->toBeFalse();
    expect(DdRoleAccess::capabilities('Engineer', true, true)['createProjects'])->toBeTrue();
    expect(DdRoleAccess::capabilities('Engineer', false, true)['createRoads'])->toBeFalse();
    expect(DdRoleAccess::capabilities('Engineer', true, true)['createRoads'])->toBeTrue();
});

it('never grants viewer any business mutation', function (): void {
    expect(DdRoleAccess::canWriteOperations('Viewer'))->toBeFalse();
    expect(DdRoleAccess::canReadAuditLog('Viewer'))->toBeFalse();
    $caps = DdRoleAccess::capabilities('Viewer', true, false);
    expect($caps['readOnly'])->toBeTrue();
    foreach (['manageAccounts', 'createProjects', 'updateProjects', 'deleteProjects', 'createRoads', 'updateRoads', 'deleteRoads', 'createUpdates', 'createDocuments', 'manageLgus'] as $key) {
        expect($caps[$key])->toBeFalse();
    }
});
