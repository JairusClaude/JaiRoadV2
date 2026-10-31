<?php

declare(strict_types=1);

use App\Http\Controllers\Dashboard\SuperAdminDashboardController;
use Illuminate\Support\Facades\Route;

// Data Dictionary: SuperAdmin system-wide authorization. Controller independently
// verifies an explicitly linked, active UserAccount with superadmin role.
Route::middleware(['auth', 'verified'])
    ->get('/superadmin-command-center', SuperAdminDashboardController::class)
    ->name('jairoads.superadmin-dashboard');
