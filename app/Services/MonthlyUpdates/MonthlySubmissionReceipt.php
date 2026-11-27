<?php

declare(strict_types=1);

namespace App\Services\MonthlyUpdates;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Review-only text submission protocol. Call from the existing authenticated
 * mutation transaction, never as a replacement for canonical authorization.
 */
final class MonthlySubmissionReceipt
{
    public const UUID_PATTERN = '/\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\z/';

    private const TABLE = 'jairoads_next.monthly_submission_receipts';

    public static function available(): bool
    {
        return config('jairoads_monthly_updates.durable_receipts_enabled') === true
            && Schema::hasTable(self::TABLE);
    }

    public static function requireEnabled(): void
    {
        abort_unless(self::available(), 503, 'Durable reporting receipts are not available.');
    }

    public static function submissionKey(Request $request, int $account, int $project, bool $editing): ?string
    {
        if (! $request->exists('submission_id')) {
            return null;
        }

        self::requireEnabled();
        $input = $request->validate([
            'submission_id' => ['required', 'string', 'regex:'.self::UUID_PATTERN],
            'reconnect_account_id' => ['required', 'integer', 'min:1'],
            'project_id' => ['required', 'integer', 'min:1'],
            'update_month' => ['required', 'string', 'regex:/\A(?!0000)[0-9]{4}-(0[1-9]|1[0-2])\z/'],
            'attachments' => ['prohibited'],
            'removed_media_ids' => ['prohibited'],
        ]);
        abort_unless(! $editing && $request->allFiles() === [], 422, 'Receipts support new text-only reports.');
        abort_unless((int) $input['reconnect_account_id'] === $account && (int) $input['project_id'] === $project, 403);

        return strtolower($input['submission_id']);
    }

    public static function fingerprint(int $project, int $record, string $month, string $progress, ?string $summary): string
    {
        // Preserve the validated decimal spelling and UTF-8 text exactly.
        // A differently spelled value is a conservative conflict, not a replay.
        return hash('sha256', json_encode([1, $project, $record, $month, $progress, $summary], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }

    public static function lock(int $account, string $submission): void
    {
        // All receipt writes acquire this account/key lock BEFORE existing
        // project -> record -> authority locks. A hash collision only serializes.
        DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['jairoads-monthly-receipt-v1:'.$account.':'.$submission]);
    }

    public static function confirmedReport(int $account, string $submission, int $project, int $record, string $month, ?string $fingerprint = null): ?int
    {
        $receipt = DB::table(self::TABLE)->where('account_id', $account)->where('submission_id', $submission)->first();
        if ($receipt === null) {
            return null;
        }

        abort_unless((int) $receipt->project_id === $project
            && (int) $receipt->maintenance_id === $record
            && $receipt->reporting_month === $month
            && ($fingerprint === null || hash_equals($receipt->fingerprint, $fingerprint)),
            409, 'Submission receipt conflicts with this report. Review before saving.');
        $report = (int) $receipt->report_id;
        abort_unless(DB::table('jairoads_next.monthly_updates')->where('id', $report)->where('created_by', $account)
            ->where('maintenance_id', $record)->where('update_month', $month)->exists(),
            409, 'The original report is no longer available at this reporting period.');

        return $report;
    }

    public static function record(int $account, string $submission, int $project, int $record, string $month, string $fingerprint, int $report): void
    {
        DB::table(self::TABLE)->insert([
            'account_id' => $account, 'submission_id' => $submission,
            'project_id' => $project, 'maintenance_id' => $record,
            'reporting_month' => $month, 'fingerprint' => $fingerprint, 'report_id' => $report,
        ]);
    }
}
