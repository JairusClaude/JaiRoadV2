<?php

declare(strict_types=1);

use App\Http\Controllers\JaiRoadsNotificationsController;
use Illuminate\Support\Facades\Route;

// Data Dictionary: an active signed-in JaiROADS account can read only its own
// eligible recipient notifications. Email verification is not an extra role rule.
// The controller requires an active linked account and scopes by recipient_user_id.
Route::get('jairoads/notifications', JaiRoadsNotificationsController::class)
    ->middleware(['auth', 'throttle:30,1'])
    ->name('jairoads.notifications');
