<?php

use App\Http\Controllers\EngineerController;
use App\Http\Controllers\LguController;
use App\Http\Controllers\MaintenanceProjectController;
use App\Http\Controllers\MonthlyUpdateController;
use App\Http\Controllers\ProjectDocumentController;
use App\Http\Controllers\RoadController;
use App\Http\Controllers\UpdatesMediaController;
use App\Http\Controllers\UserAccountController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::resource('roads', RoadController::class);
    Route::resource('lgus', LguController::class);
    Route::resource('engineers', EngineerController::class);
    Route::resource('maintenance-projects', MaintenanceProjectController::class);
    Route::resource('monthly-updates', MonthlyUpdateController::class);
    Route::resource('project-documents', ProjectDocumentController::class);
    Route::resource('updates-media', UpdatesMediaController::class);
    Route::resource('user-accounts', UserAccountController::class);
});

require __DIR__.'/settings.php';
