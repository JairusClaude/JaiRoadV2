<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;

final class FinalDdSchemaContractTest extends PostgresTestCase
{
    public function test_all_eighteen_final_dd_foreign_keys_are_restrictive_and_use_the_right_parents(): void
    {
        $expected = [
            'engineer_lgus.engineer_id' => 'engineers',
            'engineer_lgus.lgu_id' => 'lgus',
            'user_accounts.engineer_id' => 'engineers',
            'road_coverages.lgu_id' => 'lgus',
            'road_coverages.created_by' => 'engineers',
            'maintenance_projects.road_coverage_id' => 'road_coverages',
            'maintenance_projects.created_by' => 'user_accounts',
            'maintenance_records.project_id' => 'maintenance_projects',
            'maintenance_records.managing_engineer_id' => 'engineers',
            'maintenance_records.created_by' => 'user_accounts',
            'monthly_updates.maintenance_id' => 'maintenance_records',
            'monthly_updates.created_by' => 'user_accounts',
            'maintenance_documents.maintenance_id' => 'maintenance_records',
            'maintenance_documents.uploaded_by' => 'user_accounts',
            'media.monthly_update_id' => 'monthly_updates',
            'media.uploaded_by' => 'user_accounts',
            'audit_logs.user_id' => 'user_accounts',
            'audit_logs.recipient_user_id' => 'user_accounts',
        ];
        ksort($expected);

        $rows = DB::select(<<<'SQL'
            SELECT child.relname AS child_table, attribute.attname AS child_column,
                   parent.relname AS parent_table, relation.confdeltype AS delete_rule
            FROM pg_constraint relation
            JOIN pg_class child ON child.oid = relation.conrelid
            JOIN pg_namespace namespace ON namespace.oid = child.relnamespace
            JOIN pg_class parent ON parent.oid = relation.confrelid
            JOIN LATERAL unnest(relation.conkey) key_column(attnum) ON true
            JOIN pg_attribute attribute ON attribute.attrelid = relation.conrelid
                 AND attribute.attnum = key_column.attnum
            WHERE namespace.nspname = 'jairoads_next'
              AND child.relname IN ('engineer_lgus','user_accounts','road_coverages',
                  'maintenance_projects','maintenance_records','monthly_updates',
                  'maintenance_documents','media','audit_logs')
              AND relation.contype = 'f'
            SQL);
        $actual = [];
        foreach ($rows as $row) {
            $key = $row->child_table.'.'.$row->child_column;
            $this->assertSame('r', $row->delete_rule, 'ON DELETE RESTRICT required for '.$key);
            $actual[$key] = $row->parent_table;
        }
        ksort($actual);
        $this->assertCount(18, $actual);
        $this->assertSame($expected, $actual);
    }

    public function test_canonical_mandatory_fields_and_no_project_level_lgu_manager_or_status(): void
    {
        $columns = DB::table('information_schema.columns')
            ->where('table_schema', 'jairoads_next')
            ->get(['table_name', 'column_name', 'is_nullable'])
            ->keyBy(fn ($row): string => $row->table_name.'.'.$row->column_name);

        foreach ([
            'road_coverages.lgu_id', 'road_coverages.created_by',
            'maintenance_projects.road_coverage_id', 'maintenance_projects.created_by',
            'maintenance_records.project_id', 'maintenance_records.managing_engineer_id',
            'maintenance_records.created_by', 'monthly_updates.maintenance_id',
            'monthly_updates.created_by', 'maintenance_documents.maintenance_id',
            'maintenance_documents.uploaded_by', 'media.monthly_update_id',
            'media.uploaded_by', 'audit_logs.user_id',
        ] as $column) {
            $this->assertSame('NO', $columns[$column]?->is_nullable ?? null, $column.' must be required.');
        }
        foreach (['maintenance_projects.lgu_id', 'maintenance_projects.managing_engineer_id',
            'maintenance_projects.status', 'monthly_updates.project_id',
            'maintenance_documents.project_id', 'audit_logs.read_at'] as $forbidden) {
            $this->assertFalse($columns->has($forbidden), $forbidden.' is outside the Final DD.');
        }

        $this->assertSame('YES', $columns['user_accounts.engineer_id']?->is_nullable ?? null);
        $this->assertSame('YES', $columns['audit_logs.recipient_user_id']?->is_nullable ?? null);
    }

    public function test_uniqueness_for_road_to_project_and_record_to_month_is_preserved(): void
    {
        $rows = DB::select(<<<'SQL'
            SELECT relation.relname AS table_name, pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            JOIN pg_class relation ON relation.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = relation.relnamespace
            WHERE n.nspname = 'jairoads_next' AND c.contype IN ('u', 'p')
              AND relation.relname IN ('maintenance_projects', 'monthly_updates', 'engineer_lgus', 'user_accounts')
            SQL);
        $constraints = [];
        foreach ($rows as $row) {
            $constraints[$row->table_name][] = $row->definition;
        }
        $this->assertContains('UNIQUE (road_coverage_id)', $constraints['maintenance_projects'] ?? []);
        $this->assertContains('UNIQUE (maintenance_id, update_month)', $constraints['monthly_updates'] ?? []);
        $this->assertContains('PRIMARY KEY (engineer_id, lgu_id)', $constraints['engineer_lgus'] ?? []);
        $this->assertContains('UNIQUE (engineer_id)', $constraints['user_accounts'] ?? []);
    }
}
