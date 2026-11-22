<?php

declare(strict_types=1);

use App\Http\Controllers\MaintenanceDocumentUploadController;
use App\Http\Controllers\MaintenanceRecordQuickCreateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function (): void {
    Route::post('/project-documents-preview/upload', [MaintenanceDocumentUploadController::class, 'store'])
        ->middleware('throttle:10,1,jr-project-documents-upload-')->name('project-documents.upload');
    Route::post('/project-documents-preview/maintenance-records', [MaintenanceRecordQuickCreateController::class, 'store'])
        ->middleware('throttle:10,1,jr-project-documents-maintenance-records-store-')->name('project-documents.maintenance-records.store');
    Route::get('/project-documents-preview/files/{document}/download', [MaintenanceDocumentUploadController::class, 'download'])
        ->whereNumber('document')->middleware('throttle:60,1,jr-project-documents-download-')->name('project-documents.download');
});
