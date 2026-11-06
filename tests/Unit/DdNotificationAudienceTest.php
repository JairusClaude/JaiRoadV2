<?php

declare(strict_types=1);

use App\Services\DataDictionary\DdActivityNotifications;

it('keeps the audit notification audience in the requested supervisor hierarchy', function (): void {
    expect(DdActivityNotifications::recipientsFor('SuperAdmin'))->toBe(['Admin', 'SuperAdmin']);
    expect(DdActivityNotifications::recipientsFor('Admin'))->toBe(['Admin', 'SuperAdmin']);
    expect(DdActivityNotifications::recipientsFor('Engineer'))->toBe(['Admin', 'SuperAdmin']);
    expect(DdActivityNotifications::recipientsFor('Viewer'))->toBe([]);
    expect(DdActivityNotifications::recipientsFor('UnexpectedRole'))->toBe([]);
});
