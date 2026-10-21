<?php

use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

/** Fixtures exist only in an empty guarded disposable PostgreSQL 17 database. */
final class AccountTerminologyBrowserFixture extends PostgresTestCase
{
    public function prepare(): void
    {
        $this->setUp();
        $admin = $this->account('Admin');
        $superAdmin = $this->account('SuperAdmin');
        $engineer = $this->engineer();
        $this->account('Engineer', $engineer);
        $this->account('Viewer');
        DB::commit();
        echo json_encode(['admin_email' => $admin->email, 'superadmin_email' => $superAdmin->email], JSON_THROW_ON_ERROR);
    }
}

(new AccountTerminologyBrowserFixture('prepare'))->prepare();
