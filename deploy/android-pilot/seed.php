<?php

declare(strict_types=1);

require __DIR__.'/../../vendor/autoload.php';

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$database = Illuminate\Support\Facades\DB::connection('pgsql');
$url = parse_url((string) getenv('DB_URL'));
if (! app()->environment('staging')
    || getenv('RENDER') !== 'true'
    || ! preg_match('/^jairoads-android-pilot(?:-[a-z0-9]+)?$/D', (string) getenv('RENDER_SERVICE_NAME'))
    || ($url['host'] ?? '') !== 'dpg-dc5a2d56e07s73a0q8qg-a'
    || ($url['path'] ?? '') !== '/jairoads_android_pilot_db'
    || strlen((string) getenv('PILOT_APP_SECRET')) < 32
    || strlen((string) getenv('PILOT_RUNTIME_PASSWORD')) < 32) {
    fwrite(STDERR, "Refusing to seed outside the dedicated Render Android pilot.\n");
    exit(1);
}

$accounts = [
    'SuperAdmin' => 'sadmin@gmail.com',
    'Admin' => 'admin@gmail.com',
    'Engineer' => 'engineer@gmail.com',
    'Viewer' => 'viewer@gmail.com',
];

$rotateAccounts = static function () use ($database, $accounts): void {
    $replacementPassword = getenv('PILOT_REPLACEMENT_PASSWORD');
    if ($replacementPassword === false) {
        return;
    }

    if (strlen($replacementPassword) < 12 || strlen($replacementPassword) > 72) {
        throw new RuntimeException('Pilot replacement password has an invalid length.');
    }

    $state = $database->selectOne("select to_regclass('jairoads_security.android_pilot_accounts_v2') as rotated");
    if ($state->rotated !== null) {
        return;
    }

    foreach ($accounts as $role => $email) {
        $oldEmail = strtolower($role).'@android-pilot.example.test';
        $account = $database->table('jairoads_next.user_accounts')
            ->where('email', $oldEmail)
            ->where('account_type', $role)
            ->lockForUpdate()
            ->sole(['id']);
        $hash = Illuminate\Support\Facades\Hash::make($replacementPassword);
        $updated = $database->table('public.users')
            ->where('canonical_user_account_id', $account->id)
            ->where('email', $oldEmail)
            ->update([
                'email' => $email,
                'password' => $hash,
                'remember_token' => null,
                'updated_at' => now(),
            ]);
        if ($updated !== 1) {
            throw new RuntimeException('The pilot login does not match the expected seeded account.');
        }

        $database->table('jairoads_next.user_accounts')
            ->where('id', $account->id)
            ->update(['email' => $email, 'password' => $hash]);
        $database->table('public.password_reset_tokens')->where('email', $oldEmail)->delete();
    }

    $database->unprepared('CREATE TABLE jairoads_security.android_pilot_accounts_v2 (rotated_at timestamptz NOT NULL DEFAULT now())');
};

try {
    $database->transaction(function () use ($database, $accounts, $rotateAccounts): void {
        $metadata = $database->selectOne(
            "select current_database() as name, current_user as owner, current_setting('server_version_num')::int as version",
        );
        if ($metadata->name !== 'jairoads_android_pilot_db'
            || $metadata->owner !== 'jairoads_android_pilot_db_user'
            || intdiv($metadata->version, 10000) !== 17) {
            throw new RuntimeException('Unexpected pilot database identity.');
        }

        $database->select('select pg_advisory_xact_lock(907119624)');
        $state = $database->selectOne(<<<'SQL'
            select to_regclass('jairoads_security.android_pilot_initialized') as initialized,
                   exists (select 1 from pg_namespace where nspname in ('jairoads_next', 'jairoads_security'))
                   or exists (select 1 from pg_tables where schemaname = 'public') as populated
            SQL);
        if ($state->initialized !== null) {
            $rotateAccounts();

            return;
        }
        if ($state->populated || strlen((string) getenv('PILOT_TEST_PASSWORD')) < 24) {
            throw new RuntimeException('Pilot initialization requires an empty database and a test password.');
        }

        $root = dirname(__DIR__, 2);
        $database->unprepared(file_get_contents($root.'/tests/Quarterly/fixtures/canonical.sql'));
        $database->unprepared(file_get_contents(__DIR__.'/auth.sql'));
        $database->unprepared(file_get_contents($root.'/database/proposals/canonical_account_provisioning.sql'));
        $database->unprepared(file_get_contents($root.'/database/proposals/audit_notification_recipients.sql'));
        $receipts = file_get_contents($root.'/database/proposals/monthly_submission_receipts_REVIEW_ONLY.sql');
        $database->unprepared(preg_replace('/^(?:BEGIN|COMMIT);\s*$/m', '', $receipts));

        $password = $database->getPdo()->quote((string) getenv('PILOT_RUNTIME_PASSWORD'));
        $database->unprepared("CREATE ROLE jairoads_pilot_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD {$password}");
        $database->unprepared(file_get_contents(__DIR__.'/grants.sql'));

        $superadmin = null;
        $engineer = null;
        $engineerAccount = null;
        foreach (array_keys($accounts) as $role) {
            $username = strtolower($role);
            $email = $username.'@android-pilot.example.test';
            $profile = in_array($role, ['Engineer', 'Admin'], true)
                ? $database->table('jairoads_next.engineers')->insertGetId([
                    'first_name' => 'Pilot',
                    'last_name' => $role,
                    'rank' => 'Engineer II',
                ])
                : null;
            $hash = Illuminate\Support\Facades\Hash::make(getenv('PILOT_TEST_PASSWORD').'-'.$username);
            $account = $database->table('jairoads_next.user_accounts')->insertGetId([
                'username' => $username,
                'email' => $email,
                'password' => $hash,
                'account_type' => $role,
                'engineer_id' => $profile,
            ]);
            $database->table('public.users')->insert([
                'name' => 'Pilot '.$role,
                'email' => $email,
                'password' => $hash,
                'canonical_user_account_id' => $account,
                'email_verified_at' => now(),
            ]);
            if ($role === 'SuperAdmin') {
                $superadmin = $account;
            } else {
                $database->table('jairoads_security.account_provisioning')->insert([
                    'user_account_id' => $account,
                    'provisioned_by' => $superadmin,
                    'provisioner_role' => 'SuperAdmin',
                    'provisioned_role' => $role,
                    'engineer_id' => $profile,
                    'method' => 'administrator',
                ]);
            }
            if ($role === 'Engineer') {
                $engineer = $profile;
                $engineerAccount = $account;
            }
        }

        $database->statement('select set_config(?, ?, true)', ['jairoads.pilot_engineer', (string) $engineer]);
        $database->statement('select set_config(?, ?, true)', ['jairoads.pilot_account', (string) $engineerAccount]);
        $database->unprepared(file_get_contents(__DIR__.'/records.sql'));
        $database->unprepared('CREATE TABLE jairoads_security.android_pilot_initialized (created_at timestamptz NOT NULL DEFAULT now())');
        $rotateAccounts();
    });
} catch (Throwable $error) {
    // Do not log SQL bindings, the database URL or credentials.
    fwrite(STDERR, 'Pilot initialization failed ('.$error::class.', code '.$error->getCode().").\n");
    exit(1);
}
