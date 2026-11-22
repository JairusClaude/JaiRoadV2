<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\OperationAudit;
use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
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
        $year = $request->string('year', 'all')->toString();
        $year = ctype_digit($year) && strlen($year) <= 4 ? (string) (int) $year : 'all';
        $filters = ['search' => $request->string('search')->toString(), 'project' => $request->string('project', 'all')->toString(),
            'year' => $year,
            'sort' => is_string($sort) && in_array($sort, ['newest', 'oldest', 'modified'], true) ? $sort : 'newest'];
        $authorized = $this->updateQuery($actor);
        $q = (clone $authorized)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
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
            'updates' => $q->paginate(12)->withQueryString()->appends($filters)->through(fn (\stdClass $u): array => $this->updateData($u, $actor)),
            'projects' => $this->projectChoices($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectChoiceData($p)),
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

        $parents = $this->parents($actor, $request, $u === null ? null : (int) $u->maintenance_id);

        return $this->render('MonthlyUpdates/Create', $request, $parents + [
            'update' => $u === null ? null : $this->updateData($u, $actor), 'media' => $id === null ? [] : $this->mediaData($id, $actor),
            'existingUpdates' => $this->updateQuery($actor)->when($parents['contextRecordId'] !== null, fn (Builder $q) => $q->where('u.maintenance_id', $parents['contextRecordId']))->get(['u.id', 'u.maintenance_id', 'u.update_month']),
            'submitUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function saveUpdate(Request $request, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $validated = $request->validate(['attachments' => ['prohibited'], 'removed_media_ids' => ['sometimes', 'array', 'max:100'], 'removed_media_ids.*' => ['integer', 'min:1', 'distinct']]);
        $removals = array_map('intval', $validated['removed_media_ids'] ?? []);
        $editing = $id !== null;
        if ($removals !== []) {
            $this->requirePrivateDeletion($request, $actor);
            if ($id === null) {
                throw ValidationException::withMessages(['attachments' => 'Save the monthly update before removing existing media.']);
            }
            foreach ($removals as $mediaId) {
                $row = DB::table('jairoads_next.media')->where('id', $mediaId)->first(['monthly_update_id']);
                $alreadyCompleted = $row === null && DB::table('jairoads_next.file_deletions')->where('kind', 'media')
                    ->where('entity_id', $mediaId)->where('monthly_update_id', $id)->where('state', 'completed')->exists();
                if (! $alreadyCompleted && ($row === null || (int) $row->monthly_update_id !== $id)) {
                    throw ValidationException::withMessages(['attachments' => 'Selected media does not belong to this update. Refresh and retry.']);
                }
            }
        }
        $this->operations->saveUpdate($request, $this->identities, $id);
        foreach ($removals as $mediaId) {
            $this->deletePrivateFile($request, 'media', $mediaId);
        }
        $id ??= (int) DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $request->input('maintenance_id'))
            ->where('update_month', $request->input('update_month'))->value('id');

        $destination = self::BASE.'/monthly-updates/'.$id;
        if ($editing) {
            $update = $this->updateQuery($actor)->where('u.id', $id)->first();
            abort_unless($update !== null, 404);
            $destination = $this->relatedEditReturn($request, 'monthly-updates', $id, (int) $update->project_id, (int) $update->maintenance_id);
        }

        return redirect($destination)->with('dd_operations_status', 'Monthly update saved.');
    }

    public function updateShow(Request $request, int $id): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::updateShow($request, $id);
        }

        $actor = $this->actor($request);
        $u = $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_unless($u !== null, 404);

        return $this->render('MonthlyUpdates/Show', $request, [
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

        return redirect($this->relatedEditReturn($request, 'monthly-updates', $id, (int) $u->project_id, (int) $u->maintenance_id))->with('dd_operations_status', 'Private media uploaded.');
    }

    public function deleteUpdate(Request $request, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete monthly updates.');

        $this->deleteUpdates($request, $actor, [$id]);

        return redirect($this->relatedReturn($request, $actor, self::BASE.'/monthly-updates'))->with('dd_operations_status', 'Monthly update deleted successfully.');
    }

    public function bulkDelete(Request $request): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete monthly updates.');

        $v = $request->validate(['update_ids' => ['required', 'array', 'min:1', 'max:100'], 'update_ids.*' => ['required', 'integer', 'min:1', 'distinct']]);
        $this->deleteUpdates($request, $actor, array_values(array_map('intval', $v['update_ids'])));

        return redirect($this->relatedReturn($request, $actor, self::BASE.'/monthly-updates'))->with('dd_operations_status', 'Selected monthly updates deleted successfully.');
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  list<int>  $ids
     */
    private function deleteUpdates(Request $request, array $actor, array $ids): void
    {
        abort_unless($this->updateQuery($actor)->whereIn('u.id', $ids)->count() === count($ids), 404);
        $mediaIds = DB::table('jairoads_next.media')->whereIn('monthly_update_id', $ids)->orderBy('id')->pluck('id');
        if ($mediaIds->isNotEmpty()) {
            $this->requirePrivateDeletion($request, $actor);
            foreach ($mediaIds as $mediaId) {
                $this->deletePrivateFile($request, 'media', (int) $mediaId);
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
