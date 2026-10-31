<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Tests\Quarterly\PostgresTestSchema;

// The existing Feature tests use RefreshDatabase. Restore frozen disposable fixtures
// first and mark them initialized, so RefreshDatabase only opens/rolls back transactions.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
PostgresTestSchema::prepare();
RefreshDatabaseState::$migrated = true;
// Return handler stacks to their state before the fixture application booted.
// Each real Feature test then installs/cleans up its own Laravel handlers normally.
restore_exception_handler();
restore_error_handler();
