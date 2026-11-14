<?php

use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
    || config('database.connections.pgsql.host') !== '127.0.0.1' || config('database.connections.pgsql.url')
    || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', config('database.connections.pgsql.database')) || getenv('RENDER') !== false) {
    throw new RuntimeException('Unsafe historical relationship worker target.');
}
config(['database.connections.pgsql.sslmode' => 'disable']);
DB::purge('pgsql');
DB::statement("SET application_name = 'preserved_history_worker'");
DB::statement("SET lock_timeout = '12s'");
Http::preventStrayRequests();
Auth::guard()->setUser(User::findOrFail((int) $argv[1]));
$data = json_decode(base64_decode($argv[3]), true, 512, JSON_THROW_ON_ERROR);
$request = Request::create($argv[2], $argv[4], $data, server: ['HTTP_ACCEPT' => 'application/json']);
$response = $app->make(Illuminate\Contracts\Http\Kernel::class)->handle($request);
echo json_encode(['status' => $response->getStatusCode()], JSON_THROW_ON_ERROR);
