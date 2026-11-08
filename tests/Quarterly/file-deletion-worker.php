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
// Resolve the temporary marker to its real directory. tempnam() on Windows
// returns a path with backslashes, whereas the former prefix check hard-coded
// a forward slash. Never accept a nonexistent marker or a file outside temp.
$marker = $argv[4] ?? '';
$markerPath = is_file($marker) ? realpath($marker) : false;
$tempPath = realpath(sys_get_temp_dir());
$validMarker = $markerPath !== false && $tempPath !== false
    && dirname($markerPath) === $tempPath
    && str_starts_with(basename($markerPath), 'jairoads-file-delete-');

if (! $app->environment('testing') || getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
    || config('database.connections.pgsql.host') !== '127.0.0.1'
    || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', config('database.connections.pgsql.database'))
    || config('database.connections.pgsql.url') || getenv('RENDER') !== false
    || ! $validMarker) {
    throw new RuntimeException('Unsafe file deletion worker target.');
}
config(['database.connections.pgsql.sslmode' => 'disable', 'jairoads_documents.supabase_url' => 'https://disposable-storage.test',
    'jairoads_documents.service_role_key' => 'sb_secret_disposable', 'jairoads_documents.bucket' => 'private-documents']);
DB::purge('pgsql');
DB::statement("SET application_name = 'file_deletion_worker'");
DB::statement("SET lock_timeout = '12s'");
Http::preventStrayRequests();
Http::fake(['*/storage/v1/bucket/*' => Http::response(['id' => 'private-documents', 'public' => false, 'versioning_status' => 'DISABLED'])]);
Http::fake(function ($request) use ($argv) {
    if ($request->method() !== 'DELETE') {
        return null;
    }
    // Fake remote object is now gone. Block BEFORE metadata/audit commit so the
    // parent can prove concurrency, or kill this real process in the crash case.
    file_put_contents($argv[4], "object removed\n", FILE_APPEND | LOCK_EX);
    DB::statement('SELECT pg_advisory_xact_lock(1927710991)');

    return Http::response(['message' => 'Successfully deleted']);
});
Auth::guard()->setUser(User::findOrFail((int) $argv[1]));
$request = Request::create('/dd-phase3/files/document/'.$argv[2], 'DELETE', server: ['HTTP_ACCEPT' => 'application/json']);
$response = $app->make(Illuminate\Contracts\Http\Kernel::class)->handle($request);
echo json_encode(['status' => $response->getStatusCode()], JSON_THROW_ON_ERROR);
