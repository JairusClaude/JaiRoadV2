<?php

declare(strict_types=1);

use App\Http\Controllers\CanonicalAccountProvisioningController;
use App\Http\Controllers\DirectoryController;
use Illuminate\Support\Facades\Route;

it('preserves the canonical account provisioning route after extraction', function (): void {
    $matches = collect(Route::getRoutes()->getRoutes())
        ->filter(static fn ($route): bool => $route->getName() === 'jairoads.dd-phase3.accounts.store')
        ->values();

    expect($matches)->toHaveCount(1);
    $route = $matches->first();
    expect($route->uri())->toBe('dd-phase3/accounts');
    expect($route->methods())->toContain('POST');
    expect($route->getActionName())->toBe(CanonicalAccountProvisioningController::class.'@createAccount');
    expect($route->gatherMiddleware())->toContain('throttle:5,1');

    expect(method_exists(DirectoryController::class, 'createAccount'))->toBeFalse();
    expect(method_exists(CanonicalAccountProvisioningController::class, 'createAccount'))->toBeTrue();
});
