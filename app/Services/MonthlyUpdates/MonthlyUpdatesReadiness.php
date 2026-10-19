<?php

declare(strict_types=1);

namespace App\Services\MonthlyUpdates;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Fail-closed readiness check shared by GET UI and POST. Never write on an incomplete schema. */
class MonthlyUpdatesReadiness
{
    public function schemaReady(): bool
    {
        try {
            if (! Schema::hasColumns('monthly_updates', ['id', 'maintenance_id', 'update_month', 'progress_percentage', 'summary_of_text_reports', 'created_by'])
                || ! Schema::hasColumns('media', ['id', 'monthly_updates_id', 'uploaded_by', 'file_path', 'file_name', 'file_type'])
                || Schema::hasColumn('monthly_updates', 'maintenance_projects_id')) { return false; }
            $check = DB::selectOne(<<<'SQL'
                SELECT
                  EXISTS (SELECT 1 FROM pg_constraint c
                          WHERE c.conrelid = 'public.monthly_updates'::regclass AND c.contype = 'f'
                            AND c.confrelid = 'public.maintenance_records'::regclass
                            AND c.conname = 'monthly_updates_maintenance_id_foreign') AS record_fk,
                  EXISTS (SELECT 1 FROM pg_constraint c
                          WHERE c.conrelid = 'public.monthly_updates'::regclass AND c.contype = 'u'
                            AND c.conname = 'monthly_updates_record_month_unique'
                            AND pg_get_constraintdef(c.oid) LIKE '%(maintenance_id, update_month)%') AS record_month_unique,
                  EXISTS (SELECT 1 FROM pg_constraint c
                          WHERE c.conrelid = 'public.media'::regclass AND c.contype = 'f'
                            AND c.confrelid = 'public.user_accounts'::regclass
                            AND c.conname = 'media_uploaded_by_foreign') AS media_attribution,
                  EXISTS (SELECT 1 FROM pg_constraint c
                          WHERE c.conrelid = 'public.media'::regclass AND c.contype = 'f'
                            AND c.confrelid = 'public.monthly_updates'::regclass
                            AND c.conname = 'media_monthly_updates_id_foreign') AS media_link
                SQL);
            // PDO drivers may return PostgreSQL false as the string "f", which casts to true in PHP.
            $isTrue = static fn (mixed $v): bool => $v === true || $v === 1 || $v === '1' || $v === 't' || $v === 'true';
            return $isTrue($check?->record_fk) && $isTrue($check?->record_month_unique)
                && $isTrue($check?->media_attribution) && $isTrue($check?->media_link);
        } catch (\Throwable) { return false; }
    }

    public function canWrite(): bool
    {
        return (bool) config('jairoads_monthly_updates.writes_enabled', false)
            && $this->schemaReady();
    }
}
