<?php

return [
    // Deliberately OFF until SQL cutover, private bucket and role tests are approved.
    'writes_enabled' => (bool) env('JAIROADS_MONTHLY_UPDATES_WRITES_ENABLED', false),
    // Separate canonical dd-phase3 write switch. The older preview flag above
    // never controlled the canonical UI or operations routes.
    // Production/local hosting MUST explicitly opt into canonical writes only
    // after isolated staging, restricted runtime grants and role acceptance.
    // Tests retain legacy enabled behavior on disposable APP_ENV=testing DBs.
    'canonical_writes_enabled' => (bool) env('JAIROADS_DD_MONTHLY_WRITES_ENABLED', env('APP_ENV', 'production') === 'testing'),
    'supabase_url' => env('SUPABASE_URL', env('JAIROADS_SUPABASE_URL', '')),
    'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY', env('JAIROADS_SUPABASE_SERVICE_ROLE_KEY', '')),
    'bucket' => env('JAIROADS_MONTHLY_MEDIA_BUCKET', 'jairoads-monthly-media'),
];
