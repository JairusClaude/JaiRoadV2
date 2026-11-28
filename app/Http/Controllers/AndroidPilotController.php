<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\MonthlyUpdates\MonthlySubmissionReceipt;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AndroidPilotController extends OperationsFrontendController
{
    private function requirePilot(): void
    {
        abort_unless(app()->environment('staging', 'testing') && config('jairoads_monthly_updates.android_pilot_enabled') === true, 404);
    }

    public function availability(): JsonResponse
    {
        $this->requirePilot();

        return response()->json(['pilot' => 'jairoads-android-v1'])->header('Cache-Control', 'private, no-store');
    }

    public function workspace(Request $request): JsonResponse
    {
        $this->requirePilot();
        $actor = $this->actor($request);
        abort_unless(in_array($actor['role'], ['Engineer', 'Viewer'], true), 403);
        $records = $this->records($actor)
            ->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->where('m.managing_engineer_id', $actor['engineer_id']))
            ->select(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.status', 'p.project_title', 'l.municipality_name'])
            ->orderByDesc('m.maintenance_year')->orderByDesc('m.quarter')->orderByDesc('m.id')
            ->limit(101)->get();

        return response()->json([
            'accountId' => $actor['account_id'],
            'role' => $actor['role'],
            'csrfToken' => $request->session()->token(),
            'canSync' => $actor['role'] === 'Engineer' && $this->writable($actor) && MonthlySubmissionReceipt::available(),
            'truncated' => $records->count() > 100,
            'records' => $records->take(100)->values()->map(fn (\stdClass $record): array => [
                'id' => (string) $record->id,
                'projectId' => (string) $record->project_id,
                'project' => $record->project_title,
                'year' => (int) $record->maintenance_year,
                'quarter' => $record->quarter,
                'status' => $record->status,
                'municipality' => $record->municipality_name,
            ]),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function submit(Request $request): JsonResponse
    {
        $this->requirePilot();
        $actor = $this->actor($request);
        abort_unless($actor['role'] === 'Engineer', 403);
        $this->writer($actor);
        MonthlySubmissionReceipt::requireEnabled();
        $request->validate([
            'submission_id' => ['required', 'string', 'regex:'.MonthlySubmissionReceipt::UUID_PATTERN],
            'reconnect_account_id' => ['required', 'integer', 'min:1'],
            'project_id' => ['required', 'integer', 'min:1'],
            'attachments' => ['prohibited'],
            'removed_media_ids' => ['prohibited'],
        ]);
        abort_unless($request->integer('reconnect_account_id') === $actor['account_id'], 403);
        $this->operations->saveUpdate($request, $this->identities);
        $reportId = $request->attributes->getInt('jairoads.receipt_report_id');
        abort_unless($reportId > 0, 500);

        return response()->json(['reportId' => $reportId, 'receiptConfirmed' => true])->header('Cache-Control', 'private, no-store');
    }
}
