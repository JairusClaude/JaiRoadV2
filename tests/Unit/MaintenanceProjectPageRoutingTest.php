<?php

declare(strict_types=1);

use App\Http\Controllers\MaintenanceProjectPageController;
use App\Http\Controllers\MaintenanceRecordPageController;
use App\Http\Controllers\PreservedHistoryController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

it('keeps the existing maintenance-project page route contracts', function (): void {
    foreach ([
        'projects.index' => ['workspace/ui/maintenance-projects', 'GET', 'projectIndex'],
        'projects.create' => ['workspace/ui/maintenance-projects/create', 'GET', 'projectForm'],
        'projects.show' => ['workspace/ui/maintenance-projects/{id}', 'GET', 'projectShow'],
        'projects.edit' => ['workspace/ui/maintenance-projects/{id}/edit', 'GET', 'projectForm'],
        'projects.store' => ['workspace/ui/maintenance-projects', 'POST', 'saveProject'],
        'projects.update' => ['workspace/ui/maintenance-projects/{id}', 'PUT', 'saveProject'],
    ] as $name => [$uri, $verb, $method]) {
        $route = Route::getRoutes()->getByName('jairoads.ui.'.$name);
        expect($route)->not->toBeNull();
        expect($route->uri())->toBe($uri);
        expect($route->methods())->toContain($verb);
        expect($route->getActionName())->toBe(MaintenanceProjectPageController::class.'@'.$method);
    }
});

it('keeps the project deletion handler and record routing contract', function (): void {
    $deletion = Route::getRoutes()->match(
        Request::create('/workspace/ui/maintenance-projects/1', 'DELETE')
    );
    expect($deletion->getActionName())->toBe(PreservedHistoryController::class.'@delete');

    $record = Route::getRoutes()->getByName('jairoads.ui.records.create');
    expect($record)->not->toBeNull();
    expect($record->getActionName())->toBe(MaintenanceRecordPageController::class.'@recordForm');
});
