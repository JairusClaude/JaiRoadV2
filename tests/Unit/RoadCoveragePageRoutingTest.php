<?php

declare(strict_types=1);

use App\Http\Controllers\RoadCoveragePageController;
use Illuminate\Support\Facades\Route;

it('preserves canonical road coverage URLs names and action routing', function (): void {
    foreach ([
        'roads.references' => ['dd-phase3/ui/map/roads', 'roadReferences'],
        'roads.index' => ['dd-phase3/ui/road-coverages', 'roadIndex'],
        'roads.create' => ['dd-phase3/ui/road-coverages/create', 'roadForm'],
        'roads.show' => ['dd-phase3/ui/road-coverages/{id}', 'roadShow'],
        'roads.edit' => ['dd-phase3/ui/road-coverages/{id}/edit', 'roadForm'],
        'roads.store' => ['dd-phase3/ui/road-coverages', 'saveRoad'],
        'roads.update' => ['dd-phase3/ui/road-coverages/{id}', 'saveRoad'],
    ] as $name => [$uri, $action]) {
        $route = Route::getRoutes()->getByName('jairoads.ui.'.$name);
        expect($route)->not->toBeNull();
        expect($route->uri())->toBe($uri);
        expect($route->getActionName())->toBe(RoadCoveragePageController::class.'@'.$action);
    }
});
