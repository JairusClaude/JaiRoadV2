<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** A specific period conflict, distinct from other validation/database failures. */
final class DuplicateMaintenancePeriod extends ValidationException
{
    public static function detected(): self
    {
        return self::withMessages(['quarter' => 'This project already has a maintenance record for that year and quarter.']);
    }

    public static function matchesDatabaseConstraint(QueryException $error): bool
    {
        if (($error->errorInfo[0] ?? null) !== '23505'
            || ! str_starts_with($error->getSql(), 'insert into "jairoads_next"."maintenance_records" ')
            || ! preg_match('/unique constraint "([^"]+)"/', $error->errorInfo[2] ?? '', $match)) {
            return false;
        }

        // Discover the schema owner's name, rather than treating every 23505 as
        // a period conflict. Also supports a future standalone unique index.
        // Called only AFTER the failed transaction/savepoint has rolled back.
        return DB::selectOne(<<<'SQL'
SELECT i.indexrelid
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class ix ON ix.oid = i.indexrelid
WHERE i.indrelid = 'jairoads_next.maintenance_records'::regclass
  AND ix.relname = ? AND i.indisunique AND i.indisvalid
  AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts = 3
  AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
       FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
       JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
       WHERE k.n <= i.indnkeyatts) = ARRAY['maintenance_year', 'project_id', 'quarter']::text[]
SQL, [$match[1]]) !== null;
    }
}
