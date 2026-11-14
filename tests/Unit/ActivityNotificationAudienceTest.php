<?php

declare(strict_types=1);

use App\Services\ActivityNotifications;

it('keeps the audit notification audience in the requested supervisor hierarchy', function (): void {
    expect(ActivityNotifications::recipientsFor('SuperAdmin'))->toBe(['Admin', 'SuperAdmin']);
    expect(ActivityNotifications::recipientsFor('Admin'))->toBe(['Admin', 'SuperAdmin']);
    expect(ActivityNotifications::recipientsFor('Engineer'))->toBe(['Admin', 'SuperAdmin']);
    expect(ActivityNotifications::recipientsFor('Viewer'))->toBe([]);
    expect(ActivityNotifications::recipientsFor('UnexpectedRole'))->toBe([]);
});
