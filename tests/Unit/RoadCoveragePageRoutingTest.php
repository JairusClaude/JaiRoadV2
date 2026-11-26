<?php

declare(strict_types=1);

use App\Http\Controllers\RoadCoveragePageController;
use Illuminate\Support\Facades\Route;

it('preserves canonical road coverage URLs names and action routing', function (): void {
    foreach ([
        'roads.references' => ['workspace/ui/map/roads', 'roadReferences'],
        'roads.index' => ['workspace/ui/road-coverages', 'roadIndex'],
        'roads.map-page' => ['workspace/ui/map/road-index', 'roadMapPage'],
        'roads.create' => ['workspace/ui/road-coverages/create', 'roadForm'],
        'roads.show' => ['workspace/ui/road-coverages/{id}', 'roadShow'],
        'roads.edit' => ['workspace/ui/road-coverages/{id}/edit', 'roadForm'],
        'roads.store' => ['workspace/ui/road-coverages', 'saveRoad'],
        'roads.update' => ['workspace/ui/road-coverages/{id}', 'saveRoad'],
    ] as $name => [$uri, $action]) {
        $route = Route::getRoutes()->getByName('jairoads.ui.'.$name);
        expect($route)->not->toBeNull();
        expect($route->uri())->toBe($uri);
        expect($route->getActionName())->toBe(RoadCoveragePageController::class.'@'.$action);
    }
});
