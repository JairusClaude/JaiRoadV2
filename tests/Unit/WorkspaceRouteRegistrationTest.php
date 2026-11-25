<?php

declare(strict_types=1);

use App\Http\Controllers\SectionController;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

uses(TestCase::class);

it('registers each workspace method and path once and keeps an equivalent old alias', function (): void {
    $all = collect(Route::getRoutes()->getRoutes());
    $canonical = $all->filter(fn ($route) => str_starts_with($route->uri(), 'workspace/'));
    $aliases = $all->filter(fn ($route) => str_starts_with($route->uri(), 'dd-phase3/'));
    $routeKey = fn ($route) => implode('|', $route->methods()).' '.$route->uri();

    expect($canonical)->toHaveCount(96)
        ->and($aliases)->toHaveCount($canonical->count())
        ->and($canonical->map($routeKey)->unique())->toHaveCount($canonical->count())
        ->and($canonical->map(fn ($route) => $route->getName())->unique())->toHaveCount($canonical->count());

    $legacyByKey = $aliases->keyBy($routeKey);
    foreach ($canonical as $route) {
        $legacy = $legacyByKey->get(implode('|', $route->methods()).' dd-phase3'.substr($route->uri(), strlen('workspace')));
        expect($legacy)->not->toBeNull()
            ->and($legacy->wheres)->toBe($route->wheres)
            ->and($legacy->gatherMiddleware())->toBe($route->gatherMiddleware())
            ->and($legacy->getControllerClass())->toBeNull()
            ->and($legacy->getName() === null || str_starts_with($legacy->getName(), 'generated::'))->toBeTrue();
    }

    expect(Route::getRoutes()->getByName('jairoads.workspace.show')->getControllerClass())->toBe(SectionController::class)
        ->and(route('jairoads.workspace.show', ['section' => 'dashboard'], false))->toBe('/workspace/dashboard')
        ->and(route('jairoads.ui.projects.show', ['id' => 36], false))->toBe('/workspace/ui/maintenance-projects/36')
        ->and(Route::has('jairoads.dd-phase3.show'))->toBeFalse();
});
