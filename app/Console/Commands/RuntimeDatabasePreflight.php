<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\PostgresBoolean;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Read-only deployment gate. Never prints credentials, account rows or DSNs.
 * Rejects the elevated Postgres owner / BYPASSRLS account used in review.
 */
final class RuntimeDatabasePreflight extends Command
{
    protected $signature = 'jairoads:runtime-db-preflight';

    protected $description = 'Fail if this application connection has elevated database privileges or lacks canonical reads';

    public function handle(): int
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->error('PostgreSQL is required for the JaiROADS runtime.');

            return self::FAILURE;
        }

        try {
            $checks = DB::transaction(function (): array {
                DB::statement('SET TRANSACTION READ ONLY');
                $role = DB::selectOne('SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user');
                if ($role === null) {
                    return ['restricted_login' => false, 'canonical_schema_usage' => false, 'canonical_business_read' => false,
                        'authentication_infrastructure_read' => false, 'provisioning_evidence_read' => false];
                }

                $privileges = DB::selectOne("SELECT
                    has_schema_privilege(current_user,'jairoads_next','USAGE') AS canonical_usage,
                    has_table_privilege(current_user,'jairoads_next.user_accounts','SELECT') AS canonical_read,
                    has_table_privilege(current_user,'public.users','SELECT') AS login_read,
                    has_schema_privilege(current_user,'jairoads_security','USAGE')
                        AND has_table_privilege(current_user,'jairoads_security.account_provisioning','SELECT') AS provisioning_read");

                return [
                    'restricted_login' => PostgresBoolean::isTrue($role->rolcanlogin)
                        && ! PostgresBoolean::isTrue($role->rolsuper)
                        && ! PostgresBoolean::isTrue($role->rolbypassrls)
                        && ! PostgresBoolean::isTrue($role->rolcreatedb)
                        && ! PostgresBoolean::isTrue($role->rolcreaterole),
                    'canonical_schema_usage' => PostgresBoolean::isTrue($privileges->canonical_usage),
                    'canonical_business_read' => PostgresBoolean::isTrue($privileges->canonical_read),
                    'authentication_infrastructure_read' => PostgresBoolean::isTrue($privileges->login_read),
                    'provisioning_evidence_read' => PostgresBoolean::isTrue($privileges->provisioning_read),
                ];
            });
        } catch (Throwable) {
            $checks = ['runtime_database_access' => false];
        }

        $ready = ! in_array(false, $checks, true);
        $this->line(json_encode([
            'checks' => $checks,
            'restricted_runtime_preflight_passed' => $ready,
            'release_approved' => false,
            'note' => 'Permissions and runtime identity only; live role CRUD, backup recovery, Storage, MFA and human UAT are separate gates.',
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return $ready ? self::SUCCESS : self::FAILURE;
    }
}
