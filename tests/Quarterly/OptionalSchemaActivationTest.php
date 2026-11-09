<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DuplicateMaintenancePeriod;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/** Only optional file deletion and period indexes are rehearsed; no FK weakening. */
final class OptionalSchemaActivationTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        (require base_path('database/proposals/create_file_deletions.php'))->up();
        DB::unprepared(file_get_contents(base_path('database/proposals/quarterly_record_uniqueness.sql')));
    }

    public function test_optional_file_deletion_table_private_and_required_links_stay_nonnullable(): void
    {
        $row = DB::selectOne("SELECT relrowsecurity AS enabled FROM pg_class WHERE oid='jairoads_next.file_deletions'::regclass");
        $this->assertTrue($row->enabled);
        $public = DB::selectOne(<<<'SQL'
SELECT count(*) AS n
FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
WHERE c.oid = 'jairoads_next.file_deletions'::regclass AND acl.grantee = 0
  AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
SQL);
        $this->assertSame(0, (int) $public->n);
        foreach (['project_id', 'managing_engineer_id'] as $name) {
            $column = DB::table('information_schema.columns')
                ->where('table_schema', 'jairoads_next')->where('table_name', 'maintenance_records')
                ->where('column_name', $name)->value('is_nullable');
            $this->assertSame('NO', $column, $name.' must be required by Final DD');
        }
        $this->assertFalse(DB::selectOne("SELECT to_regclass('jairoads_next.maintenance_record_contexts') IS NOT NULL AS present")->present);
    }

    public function test_quarter_unique_index_does_not_relax_required_parent(): void
    {
        $f = $this->fixture('Engineer');
        $data = $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id];
        DB::table('jairoads_next.maintenance_records')->insert($data);
        try {
            DB::transaction(fn () => DB::table('jairoads_next.maintenance_records')->insert($data));
            $this->fail('Duplicate active quarter accepted.');
        } catch (QueryException $e) {
            $this->assertSame('23505', $e->errorInfo[0]);
            $this->assertTrue(DuplicateMaintenancePeriod::matchesDatabaseConstraint($e));
        }
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_file_deletion_intent_requires_valid_role_and_path(): void
    {
        $owner = $this->account('SuperAdmin');
        $base = [
            'kind' => 'document', 'entity_id' => 101,
            'requested_by' => $owner->dd_user_account_id,
            'initiated_by' => $owner->dd_user_account_id,
            'actor_role' => 'SuperAdmin', 'actor_identifier' => 'Synthetic reviewer',
            'maintenance_id' => 11, 'file_name' => 'synthetic.pdf',
            'object_path' => 'maintenance-records/11/synthetic.pdf',
            'storage_origin' => 'local-synthetic', 'bucket' => 'private-synthetic-docs',
            'state' => 'pending',
        ];
        DB::table('jairoads_next.file_deletions')->insert($base);
        foreach ([
            ['kind' => 'unknown', 'entity_id' => 102],
            ['actor_role' => 'Viewer', 'entity_id' => 103],
            ['object_path' => null, 'entity_id' => 104],
        ] as $bad) {
            try {
                DB::transaction(fn () => DB::table('jairoads_next.file_deletions')->insert(array_replace($base, $bad)));
                $this->fail('Invalid file deletion intent accepted.');
            } catch (QueryException $e) {
                $this->assertSame('23514', $e->errorInfo[0]);
            }
        }
    }
}
