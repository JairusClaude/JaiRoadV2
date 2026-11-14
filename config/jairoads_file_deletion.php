<?php

declare(strict_types=1);

return [
    // A table being present is NEVER approval to remove private Storage bytes.
    // Enable only after independent exact-object backup/restore, private bucket,
    // operator and deletion/reconciliation UAT signoff for THIS environment.
    // Default is false, including on production Render services.
    'operationally_enabled' => env('JAIROADS_PERMANENT_FILE_DELETION_ENABLED', false),
];
