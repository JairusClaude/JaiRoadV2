<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\MonthlyUpdates\MonthlySubmissionReceipt;
use App\Services\OperationAudit;
use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\BoundedDirectoryPage;
use App\Support\LiteralDirectorySearch;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Response;

/**
 * Monthly Update frontend pages. The parent retains shared read/write helpers
 * while resource-specific page actions are extracted incrementally.
 */
final class MonthlyUpdatePageController extends OperationsFrontendController
{
    public function updateIndex(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::updateIndex($request);
        }

        $actor = $this->actor($request);
        $sort = $request->query('sort');
        $year = LiteralDirectorySearch::option($request->query('year'));
        $year = ctype_digit($year) && strlen($year) <= 4 ? (string) (int) $year : 'all';
        $filters = ['search' => LiteralDirectorySearch::normalize($request->query('search')), 'project' => LiteralDirectorySearch::numericOption($request->query('project')),
            'year' => $year,
            'sort' => is_string($sort) && in_array($sort, ['newest', 'oldest', 'modified'], true) ? $sort : 'newest'];
        $authorized = $this->updateQuery($actor, false);
        $q = (clone $authorized)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', LiteralDirectorySearch::pattern($filters['search'])));
        if (ctype_digit($filters['project'])) {
            $q->where('p.id', $filters['project']);
        }
        if ($filters['year'] !== 'all') {
            // update_month is checked, zero-padded varchar(7), not a date.
            // Keep the column bare in predicates so a suitable B-tree can use the bounds.
            $bound = str_pad($filters['year'], 4, '0', STR_PAD_LEFT);
            $q->where('u.update_month', '>=', $bound.'-01')
                ->where('u.update_month', '<=', $bound.'-12');
        }
        $direction = $filters['sort'] === 'oldest' ? 'asc' : 'desc';
        $q->orderBy($filters['sort'] === 'modified' ? 'u.updated_at' : 'u.update_month', $direction)
            ->orderBy('u.id', $direction);

        $currentMonth = CarbonImmutable::now('Asia/Manila')->format('Y-m');
        $thisMonthCount = (clone $authorized)->where('u.update_month', $currentMonth)->count();

        return $this->render('MonthlyUpdates/Index', $request, [
            'totalReports' => (clone $authorized)->count(),
            'reportsThisMonth' => $thisMonthCount,
            'updates' => BoundedDirectoryPage::paginate($q, $request, 12)->appends($filters)->through(fn (\stdClass $u): array => $this->updateData($u, $actor, false)),
            ...$this->projectFilterProps($actor, $filters['project']),
            // Choice projection only; filtering above does not apply a function to the column.
            'years' => (clone $authorized)->select([])->selectRaw('substring(u.update_month, 1, 4)::integer as reporting_year')
                ->distinct()->orderByDesc('reporting_year')->pluck('reporting_year'),
            'filters' => $filters, 'canWrite' => $this->writable($actor),
            'canDelete' => RoleAccess::canDeleteOperations($actor['role']),
            'canBulkDelete' => RoleAccess::canDeleteOperations($actor['role']),
        ]);
    }

    public function updateForm(Request $request, ?int $id = null): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::updateForm($request, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $u = $id === null ? null : $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_if($id !== null && $u === null, 404);
        abort_if($u !== null && ! $this->canWriteRecord($u, $actor), 403);

        $context = $u === null ? ($request->integer('maintenance_id', $request->integer('record')) ?: null) : (int) $u->maintenance_id;
        $parents = $context === null
            ? ['projects' => [], 'records' => [], 'contextRecordId' => null, 'canWrite' => true]
            : $this->parents($actor, $request, $context);

        return $this->render('MonthlyUpdates/Create', $request, $parents + [
            'update' => $u === null ? null : $this->updateData($u, $actor), 'media' => $id === null ? [] : $this->mediaData($id, $actor),
            'formChoicesUrl' => $context === null ? self::BASE.'/monthly-updates/form-choices' : null,
            'existingUpdates' => [],
            'occupiedMonths' => $context === null ? null : $this->occupiedMonths($actor, $context, $id),
            'reconnectAccountId' => $id === null ? $actor['account_id'] : null,
            'durableReceiptsAvailable' => $id === null && MonthlySubmissionReceipt::available(),
            'submitUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function formChoices(Request $request): JsonResponse
    {
        abort_if(self::isPreview($request), 404);
        $actor = $this->actor($request);
        $this->writer($actor);
        $input = $request->validate(['page' => ['sometimes', 'integer', 'min:1'], 'project' => ['sometimes', 'integer', 'min:1'], 'record' => ['sometimes', 'integer', 'min:1'], 'record_page' => ['sometimes', 'integer', 'min:1']]);
        $records = $this->records($actor)
            ->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->where('m.managing_engineer_id', $actor['engineer_id']));
        $projects = $this->projectChoices($actor)->whereIn('p.id', (clone $records)->select('m.project_id'));
        if (isset($input['project'])) {
            $project = $projects->where('p.id', $input['project'])->first();
            abort_unless($project !== null, 404);
            $records->where('m.project_id', $project->id);

            $recordId = isset($input['record']) ? (int) $input['record'] : null;
            $projection = (clone $records)->select(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter']);
            $selected = $recordId === null ? null : (clone $projection)->where('m.id', $recordId)->first();
            abort_if($recordId !== null && $selected === null, 404);
            $perPage = 25;
            $recordPage = min((int) ($input['record_page'] ?? 1), max(1, (int) ceil((clone $records)->count() / $perPage)));
            $periods = $projection->orderByDesc('m.maintenance_year')->orderByDesc('m.quarter')->orderByDesc('m.id')
                ->simplePaginate($perPage, ['*'], 'record_page', $recordPage);
            $choices = collect($periods->items());
            if ($selected !== null && ! $choices->contains('id', $recordId)) {
                $choices->push($selected);
            }

            return response()->json([
                'project' => $this->projectChoiceData($project),
                'records' => $choices->map(fn (\stdClass $record): array => $this->periodChoiceData($record))->values(),
                'recordPage' => $recordPage,
                'recordHasMore' => $periods->hasMorePages(),
                'selectedRecordId' => $recordId,
                'existingUpdates' => [],
                'occupiedMonths' => $recordId === null ? null : $this->occupiedMonths($actor, $recordId),
            ])->header('Cache-Control', 'private, no-store');
        }

        $search = LiteralDirectorySearch::normalize($request->query('search'));
        if ($search !== '') {
            $pattern = LiteralDirectorySearch::pattern($search);
            $projects->where(fn (Builder $q) => $q->where('p.project_title', 'ilike', $pattern)->orWhere('l.municipality_name', 'ilike', $pattern));
        }
        $perPage = 20;
        $page = BoundedDirectoryPage::paginate($projects->orderBy('p.project_title')->orderBy('p.id'), $request, $perPage);
        $page->through(fn (\stdClass $project): array => $this->projectChoiceData($project));

        return response()->json(['data' => $page->items(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage()])
            ->header('Cache-Control', 'private, no-store');
    }

    /**
     * One 12-bit mask per occupied reporting year, with the edited report excluded.
     * The SQL aggregate avoids materializing an individual row per historical report.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array{recordId:int,years:object}
     */
    private function occupiedMonths(array $actor, int $recordId, ?int $excludeId = null): array
    {
        $years = $this->updateQuery($actor)->where('u.maintenance_id', $recordId)
            ->when($excludeId !== null, fn (Builder $query) => $query->where('u.id', '!=', $excludeId))
            ->select([])->selectRaw('substring(u.update_month, 1, 4) as year, bit_or(1 << (substring(u.update_month, 6, 2)::integer - 1)) as mask')
            ->groupByRaw('substring(u.update_month, 1, 4)')->orderBy('year')->get();
        $masks = [];
        foreach ($years as $year) {
            $masks[(string) $year->year] = (int) $year->mask;
        }

        return ['recordId' => $recordId, 'years' => (object) $masks];
    }

    /** Read-only period lookup; never treats a matching period as an idempotent receipt. */
    public function submissionOutcome(Request $request): JsonResponse
    {
        abort_if(self::isPreview($request), 404);
        $actor = $this->actor($request);
        $this->writer($actor);
        $input = $request->validate([
            'project_id' => ['required', 'integer', 'min:1'],
            'maintenance_id' => ['required', 'integer', 'min:1'],
            'update_month' => ['required', 'string', 'regex:/\\A(?!0000)[0-9]{4}-(0[1-9]|1[0-2])\\z/'],
            'account_id' => ['required', 'integer', 'min:1'],
            'submission_id' => ['sometimes', 'required', 'string', 'regex:'.MonthlySubmissionReceipt::UUID_PATTERN],
        ]);
        abort_unless((int) $input['account_id'] === $actor['account_id'], 403);
        $record = $this->records($actor)->where('m.id', $input['maintenance_id'])->where('m.project_id', $input['project_id'])->first();
        abort_unless($record !== null && $this->canWriteRecord($record, $actor), 404);
        if (isset($input['submission_id'])) {
            MonthlySubmissionReceipt::requireEnabled();
            $reportId = MonthlySubmissionReceipt::confirmedReport(
                $actor['account_id'], strtolower($input['submission_id']), (int) $input['project_id'], (int) $record->id, $input['update_month'],
            );

            abort_unless($this->actor($request) === $actor, 403);

            return response()->json(['reportId' => $reportId, 'receiptConfirmed' => $reportId !== null])->header('Cache-Control', 'private, no-store');
        }
        $report = DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $record->id)
            ->where('update_month', $input['update_month'])->first(['id']);

        return response()->json([
            'reportId' => $report === null ? null : (int) $report->id,
        ])->header('Cache-Control', 'private, no-store');
    }

    public function saveUpdate(Request $request, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $validated = $request->validate(['attachments' => ['prohibited'], 'removed_media_ids' => ['sometimes', 'array', 'max:100'], 'removed_media_ids.*' => ['integer', 'min:1', 'distinct']]);
        $removals = array_map('intval', $validated['removed_media_ids'] ?? []);
        $editing = $id !== null;
        if ($request->exists('reconnect_account_id')) {
            $request->validate(['reconnect_account_id' => ['required', 'integer', 'min:1']]);
            abort_unless(! $editing && $removals === [] && $request->integer('reconnect_account_id') === $actor['account_id'], 403);
        }
        if ($removals !== []) {
            $this->requirePrivateDeletion($request, $actor);
            if ($id === null) {
                throw ValidationException::withMessages(['attachments' => 'Save the monthly update before removing existing media.']);
            }
            foreach ($removals as $mediaId) {
                $row = DB::table('jairoads_next.media')->where('id', $mediaId)->first(['monthly_update_id', 'file_path']);
                $alreadyCompleted = $row === null && DB::table('jairoads_next.file_deletions')->where('kind', 'media')
                    ->where('entity_id', $mediaId)->where('monthly_update_id', $id)->where('state', 'completed')->exists();
                if (! $alreadyCompleted && ($row === null || (int) $row->monthly_update_id !== $id)) {
                    throw ValidationException::withMessages(['attachments' => 'Selected media does not belong to this update. Refresh and retry.']);
                }
                if ($row !== null) {
                    $this->fileDeletions->preflight($request->user(), 'media', $mediaId, (string) $row->file_path);
                }
            }
        }
        $this->operations->saveUpdate($request, $this->identities, $id);
        foreach ($removals as $mediaId) {
            try {
                $this->deletePrivateFile($request, 'media', $mediaId);
            } catch (ValidationException $error) {
                throw ValidationException::withMessages(['attachments' => 'Monthly update details were saved, but one or more media removals were not confirmed. Refresh the update and retry.']);
            }
        }
        $id ??= $request->attributes->getInt('jairoads.receipt_report_id') ?: (int) DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $request->input('maintenance_id'))
            ->where('update_month', $request->input('update_month'))->value('id');

        $destination = self::BASE.'/monthly-updates/'.$id;
        if ($editing) {
            $update = $this->updateQuery($actor)->where('u.id', $id)->first();
            abort_unless($update !== null, 404);
            $destination = $this->relatedEditReturn($request, 'monthly-updates', $id, (int) $update->project_id, (int) $update->maintenance_id);
        }

        return redirect($destination)->with('jairoads_operations_status', 'Monthly update saved.');
    }

    public function updateShow(Request $request, int $id): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::updateShow($request, $id);
        }

        $actor = $this->actor($request);
        $u = $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_unless($u !== null, 404);

        $comparisonQuery = $this->updateQuery($actor)->where('m.project_id', $u->project_id)->where('u.id', '!=', $id);
        $perPage = 60;
        $page = min(max(1, $request->integer('comparison_page', 1)), max(1, (int) ceil((clone $comparisonQuery)->count() / $perPage)));
        $periods = (clone $comparisonQuery)->select(['u.id', 'u.update_month'])
            ->orderByDesc('u.update_month')->orderByDesc('u.id')->simplePaginate($perPage, ['*'], 'comparison_page', $page);
        $comparisonPeriods = collect($periods->items())->map(static fn (\stdClass $row): array => ['id' => (int) $row->id, 'month' => (string) $row->update_month])->all();
        $comparisonId = $request->integer('compare');
        $comparison = $comparisonId > 0 ? (clone $comparisonQuery)->select(['u.id', 'u.update_month'])->where('u.id', $comparisonId)->first() : null;
        abort_if($comparisonId > 0 && $comparison === null, 404);
        if ($comparison !== null && ! in_array($comparisonId, array_column($comparisonPeriods, 'id'), true)) {
            array_unshift($comparisonPeriods, ['id' => (int) $comparison->id, 'month' => (string) $comparison->update_month]);
        }

        return $this->render('MonthlyUpdates/Show', $request, [
            'comparisonPeriods' => $comparisonPeriods,
            'comparisonPage' => $page,
            'comparisonHasMore' => $periods->hasMorePages(),
            'comparisonMedia' => $comparison === null ? [] : $this->mediaData((int) $comparison->id, $actor, true),
            'comparisonPeriod' => $comparison === null ? null : ['id' => (int) $comparison->id, 'month' => (string) $comparison->update_month],
            'update' => $this->updateData($u, $actor), 'media' => $this->mediaData($id, $actor), 'canWrite' => $this->canWriteRecord($u, $actor),
            'canUploadMedia' => $this->canWriteRecord($u, $actor) && $this->media->configured(),
            'backUrl' => self::BASE.'/monthly-updates', 'backLabel' => 'Monthly Updates', 'directoryUrl' => self::BASE.'/monthly-updates',
        ]);
    }

    public function uploadMedia(Request $request, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $u = $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_unless($u !== null, 404);
        $request->merge(['monthly_update_id' => $id]);
        $this->operations->uploadMedia($request, $this->identities, $this->media);

        return redirect($this->relatedEditReturn($request, 'monthly-updates', $id, (int) $u->project_id, (int) $u->maintenance_id))->with('jairoads_operations_status', 'Private media uploaded.');
    }

    public function deleteUpdate(Request $request, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete monthly updates.');

        $this->deleteUpdates($request, $actor, [$id]);

        return redirect($this->relatedReturn($request, $actor, self::BASE.'/monthly-updates'))->with('jairoads_operations_status', 'Monthly update deleted successfully.');
    }

    public function bulkDelete(Request $request): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete monthly updates.');

        $v = $request->validate(['update_ids' => ['required', 'array', 'min:1', 'max:100'], 'update_ids.*' => ['required', 'integer', 'min:1', 'distinct']]);
        $this->deleteUpdates($request, $actor, array_values(array_map('intval', $v['update_ids'])));

        return redirect($this->relatedReturn($request, $actor, self::BASE.'/monthly-updates'))->with('jairoads_operations_status', 'Selected monthly updates deleted successfully.');
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  list<int>  $ids
     */
    private function deleteUpdates(Request $request, array $actor, array $ids): void
    {
        abort_unless($this->updateQuery($actor)->whereIn('u.id', $ids)->count() === count($ids), 404);
        $mediaFiles = DB::table('jairoads_next.media')->whereIn('monthly_update_id', $ids)->orderBy('id')->get(['id', 'file_path']);
        if ($mediaFiles->isNotEmpty()) {
            $this->requirePrivateDeletion($request, $actor);
            // Check all objects and permissions before changing any Storage bytes.
            foreach ($mediaFiles as $file) {
                $this->fileDeletions->preflight($request->user(), 'media', (int) $file->id, (string) $file->file_path);
            }
            foreach ($mediaFiles as $file) {
                try {
                    $this->deletePrivateFile($request, 'media', (int) $file->id);
                } catch (ValidationException $error) {
                    throw ValidationException::withMessages(['delete' => 'Monthly update deletion was interrupted. Some media may already be gone. Refresh and review remaining records before retrying.']);
                }
            }
        }
        DB::transaction(function () use ($request, $ids, $actor): void {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
            DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->sharedLock()->first(['id']);
            abort_unless($this->actor($request) === $actor && RoleAccess::canDeleteOperations($actor['role']), 403);
            $records = DB::table('jairoads_next.monthly_updates')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            if ($records->count() !== count($ids) || DB::table('jairoads_next.media')->whereIn('monthly_update_id', $ids)->exists()) {
                throw ValidationException::withMessages(['delete' => 'Updates changed during deletion. Refresh and retry.']);
            }
            foreach ($records as $row) {
                $deleted = DB::table('jairoads_next.monthly_updates')->where('id', $row->id)->delete();
                if ($deleted !== 1 || DB::table('jairoads_next.monthly_updates')->where('id', $row->id)->exists()) {
                    throw ValidationException::withMessages(['delete' => 'Monthly update deletion was not confirmed.']);
                }
                app(OperationAudit::class)->record($actor, 'DELETE', 'MonthlyUpdate', (int) $row->id, 'Monthly update deleted after private media removal.', [], (array) $row);
            }
        });
    }
}
