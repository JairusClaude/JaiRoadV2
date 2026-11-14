<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

// Independent HTTP-kernel worker. Only invoked by the guarded PostgreSQL test.
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
    || config('database.connections.pgsql.host') !== '127.0.0.1'
    || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', config('database.connections.pgsql.database'))
    || config('database.connections.pgsql.url')) {
    throw new RuntimeException('Unsafe concurrent test target.');
}
config(['database.connections.pgsql.sslmode' => 'disable']);
DB::purge('pgsql');
DB::statement("SET application_name = 'quarterly_concurrency_worker'");
Auth::guard()->setUser(User::findOrFail((int) $argv[1]));
$data = json_decode($argv[2], true, flags: JSON_THROW_ON_ERROR);
$request = Request::create('/dd-phase3/ops/records', 'POST', $data, server: ['HTTP_ACCEPT' => 'application/json']);
$response = $app->make(Illuminate\Contracts\Http\Kernel::class)->handle($request);
echo json_encode(['status' => $response->getStatusCode(), 'body' => $response->getContent()], JSON_THROW_ON_ERROR);
