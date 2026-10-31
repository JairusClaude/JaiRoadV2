<?php

declare(strict_types=1);

use App\Http\Controllers\MaintenanceDocumentUploadController;
use App\Http\Controllers\MaintenanceRecordQuickCreateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function (): void {
    Route::post('/project-documents-preview/upload', [MaintenanceDocumentUploadController::class, 'store'])
        ->middleware('throttle:10,1')->name('project-documents.upload');
    Route::post('/project-documents-preview/maintenance-records', [MaintenanceRecordQuickCreateController::class, 'store'])
        ->middleware('throttle:10,1')->name('project-documents.maintenance-records.store');
    Route::get('/project-documents-preview/files/{document}/download', [MaintenanceDocumentUploadController::class, 'download'])
        ->whereNumber('document')->middleware('throttle:60,1')->name('project-documents.download');
});
