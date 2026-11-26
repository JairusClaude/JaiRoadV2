<?php

use App\Services\AuditActorIdentifier;

test('official audit labels preserve the original actor ID and username', function () {
    expect(AuditActorIdentifier::format(12, 'superadmin'))->toBe('User Account #12 (superadmin)')
        ->and(AuditActorIdentifier::display('DD-UserAccount#12 (superadmin)'))->toBe('User Account #12 (superadmin)')
        ->and(AuditActorIdentifier::display('dd-useraccount#12 (superadmin)'))->toBe('User Account #12 (superadmin)')
        ->and(AuditActorIdentifier::display('Engineer Name'))->toBe('Engineer Name')
        ->and(AuditActorIdentifier::display(null))->toBeNull()
        ->and(AuditActorIdentifier::description('Updated DD user account.'))->toBe('Updated user account.');
});
