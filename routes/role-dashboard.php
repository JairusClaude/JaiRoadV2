<?php

declare(strict_types=1);

use App\Http\Controllers\Dashboard\RoleDashboardController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])
    ->get('/role-dashboard', RoleDashboardController::class)
    ->name('jairoads.role-dashboard');
