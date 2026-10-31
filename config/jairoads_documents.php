<?php

declare(strict_types=1);

return [
    // Backend-only credentials. Never use VITE_ names or expose this to Inertia.
    'supabase_url' => env('SUPABASE_URL', ''),
    'service_role_key' => env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY', '')),
    'bucket' => env('JAIROADS_DOCUMENTS_BUCKET', 'jairoads-maintenance-documents'),
    // Conservative temporary limit; team can review before raising it.
    'max_file_kb' => 10240,
];
