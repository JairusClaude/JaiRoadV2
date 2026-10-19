<?php

declare(strict_types=1);

use App\Services\DataDictionary\DdActivityNotifications;

it('keeps the audit notification audience in the requested supervisor hierarchy', function (): void {
    expect(DdActivityNotifications::recipientsFor('SuperAdmin'))->toBe([]);
    expect(DdActivityNotifications::recipientsFor('Admin'))->toBe(['SuperAdmin']);
    expect(DdActivityNotifications::recipientsFor('Engineer'))->toBe(['Admin', 'SuperAdmin']);
    expect(DdActivityNotifications::recipientsFor('Viewer'))->toBe(['Admin', 'SuperAdmin']);
    expect(DdActivityNotifications::recipientsFor('UnexpectedRole'))->toBe([]);
});
