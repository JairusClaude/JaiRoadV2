<?php

declare(strict_types=1);

namespace App\Services\Files;

use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/** Durable exact-object intents. No automatic orphan deletion or arbitrary path input. */
final class UploadJournal
{
    public const TABLE = 'jairoads_next.upload_journal';

    public function begin(string $kind, int $parent, string $path, PrivateSupabaseStorage|PrivateMonthlyMediaStorage $storage): ?int
    {
        if (! config('jairoads_file_deletion.upload_journal_enabled')) {
            return null;
        }
        if (! Schema::hasTable(self::TABLE)) {
            throw ValidationException::withMessages(['file' => 'Private uploads require approved recovery setup. Contact your administrator.']);
        }
        $location = $storage->permanentLocation($path, $parent);

        return (int) DB::table(self::TABLE)->insertGetId([
            'kind' => $kind, 'parent_id' => $parent, 'object_path' => $path,
            'storage_origin' => $location['origin'], 'bucket' => $location['bucket'],
            'state' => 'pending', 'created_at' => now(),
        ]);
    }

    public function lockPending(int $id): void
    {
        abort_unless(DB::transactionLevel() > 0 && DB::table(self::TABLE)->where('id', $id)->where('state', 'pending')->lockForUpdate()->first(['id']) !== null, 409);
    }

    public function complete(int $id): void
    {
        abort_unless(DB::transactionLevel() > 0 && DB::table(self::TABLE)->where('id', $id)->where('state', 'pending')->update(['state' => 'committed', 'completed_at' => now()]) === 1, 409);
    }
}
