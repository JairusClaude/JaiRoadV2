<?php

declare(strict_types=1);

use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\LguDirectoryController;
use Illuminate\Support\Facades\Route;

it('preserves the LGU create update and delete route contracts after extraction', function (): void {
    $cases = [
        ['lgus.store', 'POST', 'lgus', 'createLgu', 'throttle:10,1', false],
        ['lgus.update', 'PUT', 'lgus/{id}', 'updateLgu', 'throttle:10,1', true],
        ['lgus.destroy', 'DELETE', 'lgus/{id}', 'deleteLgu', 'throttle:6,1', true],
    ];

    foreach ($cases as [$nameSuffix, $verb, $pathSuffix, $handler, $throttle, $numericId]) {
        $matches = collect(Route::getRoutes()->getRoutes())
            ->filter(static fn ($route): bool => is_string($route->getName())
                && $route->getName() === ('jairoads.dd-phase3.'.$nameSuffix))
            ->values();

        expect($matches)->toHaveCount(1);
        $route = $matches->first();
        expect($route->uri())->toBe('dd-phase3/'.$pathSuffix);
        expect($route->methods())->toContain($verb);
        expect($route->getActionName())->toBe(LguDirectoryController::class.'@'.$handler);
        expect($route->gatherMiddleware())->toContain($throttle);
        if ($numericId) {
            expect($route->wheres['id'] ?? null)->toBe('[0-9]+');
        }
    }

    foreach (['createLgu', 'updateLgu', 'deleteLgu'] as $method) {
        expect(method_exists(DirectoryController::class, $method))->toBeFalse();
        expect(method_exists(LguDirectoryController::class, $method))->toBeTrue();
    }
});
