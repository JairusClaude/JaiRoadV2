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
                        'authentication_infrastructure_read' => false, 'provisioning_evidence_read' => false,
                        'business_rls_enabled' => false, 'audit_append_only_privileges' => false,
                        'no_schema_create_privileges' => false, 'no_database_create_privileges' => false];
                }

                $privileges = DB::selectOne("SELECT
                    has_schema_privilege(current_user,'jairoads_next','USAGE') AS canonical_usage,
                    has_table_privilege(current_user,'jairoads_next.user_accounts','SELECT') AS canonical_read,
                    has_table_privilege(current_user,'public.users','SELECT') AS login_read,
                    has_schema_privilege(current_user,'jairoads_security','USAGE')
                        AND has_table_privilege(current_user,'jairoads_security.account_provisioning','SELECT') AS provisioning_read,
                    has_table_privilege(current_user,'jairoads_next.audit_logs','SELECT')
                        AND has_table_privilege(current_user,'jairoads_next.audit_logs','INSERT')
                        AND NOT has_table_privilege(current_user,'jairoads_next.audit_logs','UPDATE')
                        AND NOT has_table_privilege(current_user,'jairoads_next.audit_logs','DELETE')
                        AND NOT has_table_privilege(current_user,'jairoads_next.audit_logs','TRUNCATE')
                        AND NOT has_table_privilege(current_user,'jairoads_security.account_provisioning','UPDATE')
                        AND NOT has_table_privilege(current_user,'jairoads_security.account_provisioning','DELETE') AS append_only_privileges,
                    NOT has_schema_privilege(current_user,'jairoads_next','CREATE')
                        AND NOT has_schema_privilege(current_user,'public','CREATE')
                        AND NOT has_schema_privilege(current_user,'jairoads_security','CREATE') AS no_schema_create,
                    NOT has_database_privilege(current_user,current_database(),'CREATE') AS no_database_create");
                $rls = DB::selectOne("SELECT count(*) = 11 AND bool_and(c.relrowsecurity) AS enabled
                    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'jairoads_next' AND c.relkind = 'r'
                    AND c.relname IN ('lgus','engineers','engineer_lgus','user_accounts','road_coverages',
                        'maintenance_projects','maintenance_records','monthly_updates','maintenance_documents','media','audit_logs')");

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
                    'business_rls_enabled' => PostgresBoolean::isTrue($rls->enabled),
                    'audit_append_only_privileges' => PostgresBoolean::isTrue($privileges->append_only_privileges),
                    'no_schema_create_privileges' => PostgresBoolean::isTrue($privileges->no_schema_create),
                    'no_database_create_privileges' => PostgresBoolean::isTrue($privileges->no_database_create),
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
