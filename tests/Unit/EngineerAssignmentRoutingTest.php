<?php

declare(strict_types=1);

use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\EngineerAssignmentController;
use App\Http\Controllers\EngineerDirectoryController;
use Illuminate\Support\Facades\Route;

it('preserves engineer creation and assignment route contracts after extraction', function (): void {
    $cases = [
        ['jairoads.dd-phase3.engineers.store', 'dd-phase3/engineers', EngineerDirectoryController::class.'@createEngineer'],
        ['jairoads.dd-phase3.assignments.store', 'dd-phase3/assignments', EngineerAssignmentController::class.'@setAssignment'],
    ];

    foreach ($cases as [$name, $uri, $action]) {
        $matches = collect(Route::getRoutes()->getRoutes())
            ->filter(static fn ($route): bool => $route->getName() === $name)
            ->values();

        expect($matches)->toHaveCount(1);
        $route = $matches->first();
        expect($route->uri())->toBe($uri);
        expect($route->methods())->toContain('POST');
        expect($route->getActionName())->toBe($action);
        expect($route->gatherMiddleware())->toContain('throttle:10,1');
    }

    expect(method_exists(DirectoryController::class, 'createEngineer'))->toBeFalse();
    expect(method_exists(DirectoryController::class, 'setAssignment'))->toBeFalse();
    expect(method_exists(EngineerDirectoryController::class, 'createEngineer'))->toBeTrue();
    expect(method_exists(EngineerAssignmentController::class, 'setAssignment'))->toBeTrue();
});
