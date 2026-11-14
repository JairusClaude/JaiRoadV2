<?php

declare(strict_types=1);

return [
    // Explicit release configuration; never infer whether a database is safe from APP_ENV.
    // The REVIEW service pointing at official Supabase must NOT be called isolated_staging.
    'target_class' => env('JAIROADS_DEPLOYMENT_CLASS', 'unclassified'),
    'expected_supabase_ref' => env('JAIROADS_EXPECTED_SUPABASE_REF', ''),
    'official_supabase_ref' => env('JAIROADS_OFFICIAL_SUPABASE_REF', ''),
    'restricted_database_role' => env('JAIROADS_RUNTIME_DB_ROLE', 'jairoads_app_runtime'),
];
