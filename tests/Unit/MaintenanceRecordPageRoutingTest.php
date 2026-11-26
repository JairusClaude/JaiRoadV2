<?php

declare(strict_types=1);

use App\Http\Controllers\MaintenanceProjectPageController;
use App\Http\Controllers\MaintenanceRecordPageController;
use App\Http\Controllers\PreservedHistoryController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

it('preserves all eight maintenance-record route contracts', function (): void {
    foreach ([
        'records.create' => ['workspace/ui/maintenance-projects/{project}/records/create', 'GET', 'recordForm'],
        'records.show' => ['workspace/ui/maintenance-projects/{project}/records/{id}', 'GET', 'recordShow'],
        'records.edit' => ['workspace/ui/maintenance-projects/{project}/records/{id}/edit', 'GET', 'recordForm'],
        'records.store' => ['workspace/ui/maintenance-projects/{project}/records', 'POST', 'saveRecord'],
        'records.update' => ['workspace/ui/maintenance-projects/{project}/records/{id}', 'PUT', 'saveRecord'],
        'records.reassign' => ['workspace/ui/maintenance-projects/{project}/records/{id}/reassignment', 'POST', 'reassign'],
        'records.index' => ['workspace/ui/maintenance-records', 'GET', 'recordIndex'],
        'records.directory-create' => ['workspace/ui/maintenance-records/create', 'GET', 'recordCreate'],
    ] as $name => [$uri, $verb, $method]) {
        $route = Route::getRoutes()->getByName('jairoads.ui.'.$name);
        expect($route)->not->toBeNull();
        expect($route->uri())->toBe($uri);
        expect($route->methods())->toContain($verb);
        expect($route->getActionName())->toBe(MaintenanceRecordPageController::class.'@'.$method);
    }
});

it('keeps project pages and preservation deletion handlers unchanged', function (): void {
    $project = Route::getRoutes()->getByName('jairoads.ui.projects.index');
    expect($project)->not->toBeNull();
    expect($project->getActionName())->toBe(MaintenanceProjectPageController::class.'@projectIndex');

    $deletion = Route::getRoutes()->match(Request::create('/workspace/ui/maintenance-projects/1', 'DELETE'));
    expect($deletion->getActionName())->toBe(PreservedHistoryController::class.'@delete');
});
