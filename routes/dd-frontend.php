<?php

declare(strict_types=1);

use App\Http\Controllers\DataDictionary\DdFrontendController;
use Illuminate\Support\Facades\Route;

// These URLs are canonical DD projections. Legacy public.* route quarantine stays intact.
Route::middleware(['auth', 'verified'])->prefix('dd-phase3/ui')->name('jairoads.ui.')->group(function (): void {
    Route::get('/road-coverages', [DdFrontendController::class, 'roadIndex'])->name('roads.index');
    Route::get('/road-coverages/create', [DdFrontendController::class, 'roadForm'])->name('roads.create');
    Route::get('/road-coverages/{id}', [DdFrontendController::class, 'roadShow'])->whereNumber('id')->name('roads.show');
    Route::get('/road-coverages/{id}/edit', [DdFrontendController::class, 'roadForm'])->whereNumber('id')->name('roads.edit');
    Route::post('/road-coverages', [DdFrontendController::class, 'saveRoad'])->name('roads.store');
    Route::put('/road-coverages/{id}', [DdFrontendController::class, 'saveRoad'])->whereNumber('id')->name('roads.update');
    Route::get('/maintenance-projects', [DdFrontendController::class, 'projectIndex'])->name('projects.index');
    Route::get('/maintenance-projects/create', [DdFrontendController::class, 'projectForm'])->name('projects.create');
    Route::get('/maintenance-projects/{id}', [DdFrontendController::class, 'projectShow'])->whereNumber('id')->name('projects.show');
    Route::get('/maintenance-projects/{id}/edit', [DdFrontendController::class, 'projectForm'])->whereNumber('id')->name('projects.edit');
    Route::post('/maintenance-projects', [DdFrontendController::class, 'saveProject'])->name('projects.store');
    Route::put('/maintenance-projects/{id}', [DdFrontendController::class, 'saveProject'])->whereNumber('id')->name('projects.update');
    Route::get('/maintenance-projects/{project}/records/create', [DdFrontendController::class, 'recordForm'])->whereNumber('project')->name('records.create');
    Route::get('/maintenance-projects/{project}/records/{id}', [DdFrontendController::class, 'recordShow'])->whereNumber('project')->whereNumber('id')->name('records.show');
    Route::get('/maintenance-projects/{project}/records/{id}/edit', [DdFrontendController::class, 'recordForm'])->whereNumber('project')->whereNumber('id')->name('records.edit');
    Route::post('/maintenance-projects/{project}/records', [DdFrontendController::class, 'saveRecord'])->whereNumber('project')->name('records.store');
    Route::put('/maintenance-projects/{project}/records/{id}', [DdFrontendController::class, 'saveRecord'])->whereNumber('project')->whereNumber('id')->name('records.update');
    Route::post('/maintenance-projects/{project}/records/{id}/reassignment', [DdFrontendController::class, 'reassign'])->whereNumber('project')->whereNumber('id')->middleware('throttle:10,1')->name('records.reassign');
    Route::get('/maintenance-records', [DdFrontendController::class, 'recordIndex'])->name('records.index');
    Route::get('/maintenance-records/create', [DdFrontendController::class, 'recordCreate'])->name('records.directory-create');
    Route::get('/monthly-updates', [DdFrontendController::class, 'updateIndex'])->name('updates.index');
    Route::get('/monthly-updates/create', [DdFrontendController::class, 'updateForm'])->name('updates.create');
    Route::get('/monthly-updates/{id}', [DdFrontendController::class, 'updateShow'])->whereNumber('id')->name('updates.show');
    Route::get('/monthly-updates/{id}/edit', [DdFrontendController::class, 'updateForm'])->whereNumber('id')->name('updates.edit');
    Route::post('/monthly-updates', [DdFrontendController::class, 'saveUpdate'])->name('updates.store');
    Route::put('/monthly-updates/{id}', [DdFrontendController::class, 'saveUpdate'])->whereNumber('id')->name('updates.update');
    Route::post('/monthly-updates/{id}/media', [DdFrontendController::class, 'uploadMedia'])->whereNumber('id')->middleware('throttle:8,1')->name('updates.media');
    Route::get('/maintenance-documents', [DdFrontendController::class, 'documentIndex'])->name('documents.index');
    Route::get('/maintenance-documents/create', [DdFrontendController::class, 'documentForm'])->name('documents.create');
    Route::get('/maintenance-documents/{id}', [DdFrontendController::class, 'documentShow'])->whereNumber('id')->name('documents.show');
    Route::get('/maintenance-documents/{id}/edit', [DdFrontendController::class, 'documentForm'])->whereNumber('id')->name('documents.edit');
    Route::post('/maintenance-documents', [DdFrontendController::class, 'saveDocument'])->middleware('throttle:8,1')->name('documents.store');
    Route::put('/maintenance-documents/{id}', [DdFrontendController::class, 'saveDocument'])->whereNumber('id')->middleware('throttle:10,1')->name('documents.update');
});
