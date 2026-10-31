<?php

return [
    // Deliberately OFF until SQL cutover, private bucket and role tests are approved.
    'writes_enabled' => (bool) env('JAIROADS_MONTHLY_UPDATES_WRITES_ENABLED', false),
    'supabase_url' => env('SUPABASE_URL', env('JAIROADS_SUPABASE_URL', '')),
    'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY', env('JAIROADS_SUPABASE_SERVICE_ROLE_KEY', '')),
    'bucket' => env('JAIROADS_MONTHLY_MEDIA_BUCKET', 'jairoads-monthly-media'),
];
