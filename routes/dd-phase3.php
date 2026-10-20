<?php

declare(strict_types=1);

use App\Http\Controllers\DataDictionary\DdOperationsController;
use App\Http\Controllers\DataDictionary\DdPhase3Controller;
use App\Http\Controllers\DataDictionary\DdSectionController;
use Illuminate\Support\Facades\Route;

// Explicit Data Dictionary-only routes. Never share legacy controller/permission paths.
Route::middleware(['auth', 'verified'])->prefix('dd-phase3')->name('jairoads.dd-phase3.')->group(function (): void {
    // A single GET section router: registration of two /{section} routes
    // previously replaced the named dashboard route and caused routing failures.
    Route::get('/ops/{section}', DdSectionController::class)
        ->whereIn('section', ['settings', 'roads', 'projects', 'updates', 'documents'])
        ->name('operations.show');
    Route::get('/{section}', DdSectionController::class)
        ->whereIn('section', ['dashboard', 'users', 'lgus', 'settings', 'roads', 'projects', 'updates', 'documents'])
        ->name('show');
    Route::post('/lgus', [DdPhase3Controller::class, 'createLgu'])->middleware('throttle:10,1')->name('lgus.store');
    Route::put('/lgus/{id}', [DdPhase3Controller::class, 'updateLgu'])->whereNumber('id')->middleware('throttle:10,1')->name('lgus.update');
    Route::delete('/lgus/{id}', [DdPhase3Controller::class, 'deleteLgu'])->whereNumber('id')->middleware('throttle:6,1')->name('lgus.destroy');
    Route::post('/engineers', [DdPhase3Controller::class, 'createEngineer'])->middleware('throttle:10,1')->name('engineers.store');
    Route::post('/assignments', [DdPhase3Controller::class, 'setAssignment'])->middleware('throttle:10,1')->name('assignments.store');
    Route::post('/accounts', [DdPhase3Controller::class, 'createAccount'])->middleware('throttle:5,1')->name('accounts.store');

    // Explicitly qualified DD module endpoints; never use legacy CRUD routes.
    Route::post('/ops/roads', [DdOperationsController::class, 'saveRoad'])->name('operations.roads.store');
    Route::put('/ops/roads/{id}', [DdOperationsController::class, 'saveRoad'])->whereNumber('id');
    Route::post('/ops/projects', [DdOperationsController::class, 'saveProject'])->name('operations.projects.store');
    Route::put('/ops/projects/{id}', [DdOperationsController::class, 'saveProject'])->whereNumber('id');
    Route::post('/ops/records', [DdOperationsController::class, 'saveRecord'])->name('operations.records.store');
    Route::put('/ops/records/{id}', [DdOperationsController::class, 'saveRecord'])->whereNumber('id');
    Route::post('/ops/updates', [DdOperationsController::class, 'saveUpdate'])->name('operations.updates.store');
    Route::put('/ops/updates/{id}', [DdOperationsController::class, 'saveUpdate'])->whereNumber('id');
    Route::delete('/ops/{entity}/{id}', [DdOperationsController::class, 'deleteEntity'])
        ->whereIn('entity', ['roads', 'projects', 'records', 'updates'])->whereNumber('id');
    Route::put('/ops/settings', [DdOperationsController::class, 'saveSettings'])->middleware('throttle:6,1');
    Route::post('/ops/documents', [DdOperationsController::class, 'uploadDocument'])->middleware('throttle:8,1');
    Route::put('/ops/documents/{id}', [DdOperationsController::class, 'updateDocument'])->whereNumber('id')->middleware('throttle:10,1')->name('operations.documents.update');
    Route::post('/ops/media', [DdOperationsController::class, 'uploadMedia'])->middleware('throttle:8,1');
    Route::get('/files/{kind}/{id}', [DdOperationsController::class, 'download'])
        ->whereIn('kind', ['document', 'media'])->whereNumber('id')->name('operations.files.download');
});
