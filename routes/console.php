<?php

use App\Services\Files\FileRecoverySchedule;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Registration fails closed without both approval flags and shared locking.
FileRecoverySchedule::register(app(Schedule::class));
