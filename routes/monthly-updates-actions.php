<?php

declare(strict_types=1);

use App\Http\Controllers\MonthlyUpdateSubmissionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function (): void {
    Route::post('/monthly-updates-preview/save', [MonthlyUpdateSubmissionController::class, 'store'])
        ->middleware('throttle:8,1')->name('monthly-updates.preview.save');
    Route::get('/monthly-updates-preview/media/{media}/download', [MonthlyUpdateSubmissionController::class, 'download'])
        ->whereNumber('media')->middleware('throttle:40,1')->name('monthly-updates.preview.media.download');
});
