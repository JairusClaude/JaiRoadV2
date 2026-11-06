<?php

// CLI-only synthetic fixture mutation. Never exposed as an application route.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('testing') || getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
    || config('database.connections.pgsql.host') !== '127.0.0.1' || config('database.connections.pgsql.url')
    || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', config('database.connections.pgsql.database')) || getenv('RENDER') !== false) {
    throw new RuntimeException('Unsafe passkey fixture target.');
}
config(['database.connections.pgsql.sslmode' => 'disable']);
DB::purge('pgsql');
$server = DB::selectOne("SELECT current_database() AS name, current_setting('server_version_num')::int AS version");
if ($server->name !== config('database.connections.pgsql.database') || $server->version < 170000 || $server->version >= 180000) {
    throw new RuntimeException('Disposable PostgreSQL 17 required.');
}
$fixture = json_decode(file_get_contents(getenv('PASSKEY_BROWSER_FIXTURE')), true, flags: JSON_THROW_ON_ERROR);
$user = collect($fixture['users'])->firstWhere('id', (int) ($argv[1] ?? 0));
$action = $argv[2] ?? '';
if (! $user || ! in_array($action, ['reset', 'inactive', 'retired', 'hash', 'email', 'missing', 'invalid-link', 'snapshot'], true)) {
    throw new RuntimeException('Unknown disposable passkey fixture.');
}
if ($action === 'snapshot') {
    echo json_encode(DB::table('public.passkeys')->where('user_id', $user['id'])->orderBy('id')->get(['id', 'user_id', 'credential_id'])->all(), JSON_THROW_ON_ERROR);
    exit;
}
DB::transaction(function () use ($user, $action): void {
    $login = DB::table('public.users')->where('id', $user['id'])->first();
    if ($user['account_id'] === null) {
        throw new RuntimeException('Legacy fixture must not acquire a canonical link.');
    }
    // Corrupt-link cases deliberately rehearse states production FKs normally
    // reject; LOCAL replica mode is confined to this positively guarded DB/tx.
    if ($action === 'missing') {
        DB::statement("SET LOCAL session_replication_role = 'replica'");
    }
    $accountId = $action === 'missing' ? 999999999 : $user['account_id'];
    if ($action === 'invalid-link') {
        $accountId = DB::table('jairoads_next.user_accounts')->where('id', '!=', $user['account_id'])->value('id');
        DB::table('public.users')->where('dd_user_account_id', $accountId)->where('id', '!=', $user['id'])->update(['dd_user_account_id' => null]);
    }
    DB::table('public.users')->where('id', $user['id'])->update(['dd_user_account_id' => $accountId]);
    if ($action === 'reset') {
        $fixture = json_decode(file_get_contents(getenv('PASSKEY_BROWSER_FIXTURE')), true, flags: JSON_THROW_ON_ERROR);
        foreach ($fixture['users'] as $other) {
            if ($other['account_id'] !== null) {
                DB::table('public.users')->where('id', $other['id'])->whereNull('dd_user_account_id')->update(['dd_user_account_id' => $other['account_id']]);
            }
        }
    }
    DB::table('jairoads_next.user_accounts')->where('id', $user['account_id'])->update([
        'is_active' => $action !== 'inactive', 'email' => $action === 'email' ? 'mismatch@example.test' : $login->email,
        'password' => $action === 'hash' ? 'invalid-disposable-hash' : $login->password,
    ]);
    if ($user['engineer_id'] !== null) {
        DB::table('jairoads_next.engineers')->where('id', $user['engineer_id'])->update(['engineer_status' => $action === 'retired' ? 'Retired' : 'Active']);
    }
});
echo "Fixture state updated.\n";
