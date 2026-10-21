<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

// Only prepares an explicitly guarded, empty disposable database for browser testing.
require __DIR__.'/../../vendor/autoload.php';

final class QuarterlyBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $fixture = $this->fixture();
        DB::commit();
        echo json_encode(['email' => $fixture['user']->email, 'project' => $fixture['project']], JSON_THROW_ON_ERROR);
    }
}

(new QuarterlyBrowserFixture('prepare'))->prepare();
