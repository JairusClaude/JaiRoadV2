<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\DuplicateMaintenancePeriod;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

final class OptionalSchemaActivationTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Rehearsal only: the source proposals are NOT Laravel migrations.
        (require base_path('database/proposals/create_file_deletions.php'))->up();
        (require base_path('database/proposals/preserve_project_history.php'))->up();
        DB::unprepared(file_get_contents(base_path('database/proposals/quarterly_record_uniqueness.sql')));
    }

    public function test_optional_tables_are_private_and_detachment_columns_are_nullable(): void
    {
        foreach (['file_deletions', 'maintenance_record_contexts'] as $table) {
            $row = DB::selectOne('SELECT relrowsecurity AS enabled
                FROM pg_class WHERE oid = ?::regclass', ['jairoads_next.'.$table]);
            $this->assertTrue($row->enabled);

            $public = DB::selectOne(<<<'SQL'
SELECT count(*) AS n
FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
WHERE c.oid = ?::regclass AND acl.grantee = 0
  AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
SQL, ['jairoads_next.'.$table]);
            $this->assertSame(0, (int) $public->n);
        }

        foreach (['project_id', 'managing_engineer_id'] as $name) {
            $column = DB::selectOne(<<<'SQL'
SELECT is_nullable FROM information_schema.columns
WHERE table_schema='jairoads_next' AND table_name='maintenance_records'
AND column_name=?
SQL, [$name]);
            $this->assertSame('YES', $column->is_nullable);
        }

        $index = DB::selectOne(<<<'SQL'
SELECT i.indisunique AS is_unique, i.indpred IS NULL AS not_partial,
       i.indexprs IS NULL AS not_expression, i.indnkeyatts AS key_count
FROM pg_index i JOIN pg_class ix ON ix.oid=i.indexrelid
WHERE i.indrelid='jairoads_next.maintenance_records'::regclass
AND ix.relname='maintenance_records_project_year_quarter_unique'
SQL);
        $this->assertNotNull($index);
        $this->assertTrue($index->is_unique);
        $this->assertTrue($index->not_partial);
        $this->assertTrue($index->not_expression);
        $this->assertSame(3, (int) $index->key_count);
    }

    public function test_quarter_uniqueness_rejects_active_duplicates_without_blocking_detached_history(): void
    {
        $f = $this->fixture('Engineer');
        $project = $f['project'];
        $writer = $f['user']->dd_user_account_id;

        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($project, $f['engineer']) + ['created_by' => $writer]
        );
        try {
            DB::transaction(fn () => DB::table('jairoads_next.maintenance_records')->insert(
                $this->recordData($project, $f['engineer']) + ['created_by' => $writer]
            ));
            $this->fail('Duplicate active project/year/quarter was accepted.');
        } catch (QueryException $error) {
            $this->assertSame('23505', $error->errorInfo[0]);
            $this->assertTrue(DuplicateMaintenancePeriod::matchesDatabaseConstraint($error));
        }

        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
        DB::table('jairoads_next.maintenance_record_contexts')->insert([
            'maintenance_id' => $record,
            'previous_project_id' => $project,
            'snapshot' => json_encode(['project_title' => 'Synthetic retained project'], JSON_THROW_ON_ERROR),
            'detached_by' => $writer,
        ]);
        DB::table('jairoads_next.maintenance_records')->where('id', $record)->update(['project_id' => null]);

        $second = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($project, $f['engineer']) + ['created_by' => $writer]
        );
        DB::table('jairoads_next.maintenance_record_contexts')->insert([
            'maintenance_id' => $second,
            'previous_project_id' => $project,
            'snapshot' => json_encode(['project_title' => 'Synthetic retained project'], JSON_THROW_ON_ERROR),
            'detached_by' => $writer,
        ]);
        DB::table('jairoads_next.maintenance_records')->where('id', $second)->update(['project_id' => null]);

        // Two preserved records with NULL project_id may coexist. A new
        // active project record still has a unique (project, year, quarter).
        DB::table('jairoads_next.maintenance_records')->insert(
            $this->recordData($project, $f['engineer']) + ['created_by' => $writer]
        );
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')
            ->whereNull('project_id')->where('maintenance_year', 2026)->where('quarter', 'Q1')->count());
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')
            ->where('project_id', $project)->where('maintenance_year', 2026)->where('quarter', 'Q1')->count());
        $this->assertSame(3, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_missing_detachment_context_is_rejected_and_history_cannot_be_rewritten(): void
    {
        $f = $this->fixture();
        $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]
        );

        try {
            DB::transaction(function () use ($id): void {
                DB::table('jairoads_next.maintenance_records')->where('id', $id)->update(['project_id' => null]);
                DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
            });
            $this->fail('Missing context for a detached record was accepted.');
        } catch (QueryException $error) {
            $this->assertSame('P0001', $error->errorInfo[0]);
        }

        $this->assertSame($f['project'], (int) DB::table('jairoads_next.maintenance_records')
            ->where('id', $id)->value('project_id'));
        DB::table('jairoads_next.maintenance_record_contexts')->insert([
            'maintenance_id' => $id,
            'previous_project_id' => $f['project'],
            'snapshot' => '{"approved":"synthetic-only"}',
            'detached_by' => $f['user']->dd_user_account_id,
        ]);
        foreach (['UPDATE jairoads_next.maintenance_record_contexts SET snapshot = \'{}\'',
            'DELETE FROM jairoads_next.maintenance_record_contexts',
            'TRUNCATE jairoads_next.maintenance_record_contexts'] as $sql) {
            try {
                DB::transaction(fn () => DB::statement($sql));
                $this->fail('Historical context mutation should be blocked.');
            } catch (QueryException $error) {
                $this->assertSame('P0001', $error->errorInfo[0]);
            }
        }
        $this->assertSame(1, DB::table('jairoads_next.maintenance_record_contexts')->count());
    }

    public function test_file_deletion_intent_requires_correct_kind_actor_and_durable_storage_target(): void
    {
        $owner = $this->account('SuperAdmin');
        $base = [
            'kind' => 'document',
            'entity_id' => 101,
            'requested_by' => $owner->dd_user_account_id,
            'initiated_by' => $owner->dd_user_account_id,
            'actor_role' => 'SuperAdmin',
            'actor_identifier' => 'Synthetic reviewer',
            'maintenance_id' => 11,
            'file_name' => 'synthetic.pdf',
            'object_path' => 'maintenance-records/11/synthetic.pdf',
            'storage_origin' => 'local-synthetic',
            'bucket' => 'private-synthetic-docs',
            'state' => 'pending',
        ];
        DB::table('jairoads_next.file_deletions')->insert($base);
        foreach ([
            ['kind' => 'unknown', 'entity_id' => 102],
            ['actor_role' => 'Viewer', 'entity_id' => 103],
            ['object_path' => null, 'entity_id' => 104],
        ] as $invalid) {
            try {
                DB::transaction(fn () => DB::table('jairoads_next.file_deletions')->insert(array_replace($base, $invalid)));
                $this->fail('Invalid durable-file deletion intent accepted.');
            } catch (QueryException $error) {
                $this->assertSame('23514', $error->errorInfo[0]);
            }
        }
        try {
            DB::transaction(fn () => DB::table('jairoads_next.file_deletions')->insert($base));
            $this->fail('Duplicate file deletion intent accepted.');
        } catch (QueryException $error) {
            $this->assertSame('23505', $error->errorInfo[0]);
        }
        $this->assertSame(1, DB::table('jairoads_next.file_deletions')->count());
    }
}
