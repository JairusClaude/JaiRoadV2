<?php

declare(strict_types=1);

use App\Http\Controllers\AuditHistoryController;
use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\LguDirectoryController;
use App\Http\Controllers\OperationsController;
use App\Http\Controllers\PeopleLifecycleController;
use App\Http\Controllers\PreservedHistoryController;
use App\Http\Controllers\RoadMunicipalityChangeController;
use App\Http\Controllers\SectionController;
use Illuminate\Support\Facades\Route;

// Explicit Data Dictionary-only routes. Never share legacy controller/permission paths.
Route::middleware(['auth'])->prefix('dd-phase3')->name('jairoads.dd-phase3.')->group(function (): void {
    Route::get('/audit-logs', AuditHistoryController::class)->name('audit.index');
    // A single GET section router: registration of two /{section} routes
    // previously replaced the named dashboard route and caused routing failures.
    Route::get('/ops/{section}', SectionController::class)
        ->whereIn('section', ['settings', 'roads', 'projects', 'updates', 'documents'])
        ->name('operations.show');
    Route::get('/{section}', SectionController::class)
        ->whereIn('section', ['dashboard', 'users', 'lgus', 'settings', 'roads', 'projects', 'updates', 'documents'])
        ->name('show');
    Route::post('/lgus', [LguDirectoryController::class, 'createLgu'])->middleware('throttle:10,1')->name('lgus.store');
    Route::put('/lgus/{id}', [LguDirectoryController::class, 'updateLgu'])->whereNumber('id')->middleware('throttle:10,1')->name('lgus.update');
    Route::delete('/lgus/{id}', [LguDirectoryController::class, 'deleteLgu'])->whereNumber('id')->middleware('throttle:6,1')->name('lgus.destroy');
    Route::post('/engineers', [DirectoryController::class, 'createEngineer'])->middleware('throttle:10,1')->name('engineers.store');
    Route::post('/assignments', [DirectoryController::class, 'setAssignment'])->middleware('throttle:10,1')->name('assignments.store');
    Route::post('/accounts', [DirectoryController::class, 'createAccount'])->middleware('throttle:5,1')->name('accounts.store');

    Route::put('/engineers/{id}', [PeopleLifecycleController::class, 'updateEngineer'])->whereNumber('id');
    Route::post('/engineers/{id}/retirement', [PeopleLifecycleController::class, 'retireEngineer'])->whereNumber('id');

    Route::get('/accounts/{id}', [PeopleLifecycleController::class, 'accountDetails'])->whereNumber('id');
    Route::patch('/accounts/{id}/status', [PeopleLifecycleController::class, 'accountStatus'])->whereNumber('id');

    Route::get('/history/records', [PreservedHistoryController::class, 'index'])->name('history.index');
    Route::get('/history/records/{id}', [PreservedHistoryController::class, 'show'])->whereNumber('id')->name('history.show');
    Route::get('/ops/projects/{id}/deletion-preview', [PreservedHistoryController::class, 'preview'])->whereNumber('id');
    Route::post('/ops/records/{id}/unassignment', [OperationsController::class, 'unassignRecord'])->whereNumber('id')->middleware('throttle:10,1');

    // Explicitly qualified DD module endpoints; never use legacy CRUD routes.
    Route::post('/ops/roads', [OperationsController::class, 'saveRoad'])->name('operations.roads.store');
    Route::put('/ops/roads/{id}', [OperationsController::class, 'saveRoad'])->whereNumber('id');
    Route::post('/ops/roads/{id}/municipality/preview', [RoadMunicipalityChangeController::class, 'previewRoadMunicipality'])->whereNumber('id')->name('operations.roads.municipality.preview');
    Route::post('/ops/roads/{id}/municipality/confirm', [RoadMunicipalityChangeController::class, 'confirmRoadMunicipality'])->whereNumber('id')->name('operations.roads.municipality.confirm');
    Route::post('/ops/projects', [OperationsController::class, 'saveProject'])->name('operations.projects.store');
    Route::put('/ops/projects/{id}', [OperationsController::class, 'saveProject'])->whereNumber('id');
    Route::post('/ops/records', [OperationsController::class, 'saveRecord'])->name('operations.records.store');
    Route::put('/ops/records/{id}', [OperationsController::class, 'saveRecord'])->whereNumber('id');
    Route::post('/ops/records/{id}/reassignment', [OperationsController::class, 'reassignRecord'])->whereNumber('id')->middleware('throttle:10,1');
    Route::post('/ops/updates', [OperationsController::class, 'saveUpdate'])->name('operations.updates.store');
    Route::put('/ops/updates/{id}', [OperationsController::class, 'saveUpdate'])->whereNumber('id');
    Route::delete('/ops/{entity}/{id}', [OperationsController::class, 'deleteEntity'])
        ->whereIn('entity', ['roads', 'projects', 'records', 'updates'])->whereNumber('id');
    Route::put('/ops/settings', [OperationsController::class, 'saveSettings'])->middleware('throttle:6,1');
    Route::post('/ops/documents', [OperationsController::class, 'uploadDocument'])->middleware('throttle:8,1');
    Route::put('/ops/documents/{id}', [OperationsController::class, 'updateDocument'])->whereNumber('id')->middleware('throttle:10,1')->name('operations.documents.update');
    Route::post('/ops/media', [OperationsController::class, 'uploadMedia'])->middleware('throttle:8,1');
    Route::get('/files/{kind}/{id}/deletion-review', [OperationsController::class, 'fileRemovalReview'])
        ->whereIn('kind', ['document', 'media'])->whereNumber('id');
    Route::delete('/files/{kind}/{id}', [OperationsController::class, 'deleteFile'])
        ->whereIn('kind', ['document', 'media'])->whereNumber('id')->middleware('throttle:10,1')->name('operations.files.destroy');
    Route::get('/files/{kind}/{id}', [OperationsController::class, 'download'])
        ->whereIn('kind', ['document', 'media'])->whereNumber('id')->name('operations.files.download');
});
