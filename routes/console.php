<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// A scheduler process and explicit environment-specific approval are required.
if (config('jairoads_file_deletion.scheduled_reconciliation') && config('jairoads_file_deletion.operationally_enabled')) {
    Schedule::command('jairoads:resume-file-deletions --limit=20')->everyFiveMinutes()->withoutOverlapping(10)->onOneServer();
}
