<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
    || config('database.connections.pgsql.host') !== '127.0.0.1'
    || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', config('database.connections.pgsql.database'))
    || config('database.connections.pgsql.url') || getenv('RENDER') !== false) {
    throw new RuntimeException('Unsafe monthly concurrency test target.');
}
config(['database.connections.pgsql.sslmode' => 'disable']);
DB::purge('pgsql');
DB::statement("SET application_name = 'monthly_revocation_worker'");
DB::statement("SET lock_timeout = '12s'");
Auth::guard()->setUser(User::findOrFail((int) $argv[1]));
$data = json_decode($argv[4], true, flags: JSON_THROW_ON_ERROR);
$request = Request::create($argv[3], $argv[2], $data, server: ['HTTP_ACCEPT' => 'application/json']);
$response = $app->make(Illuminate\Contracts\Http\Kernel::class)->handle($request);
echo json_encode(['status' => $response->getStatusCode()], JSON_THROW_ON_ERROR);
