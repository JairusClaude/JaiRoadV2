<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\DeletionChallenge;
use App\Services\DuplicateMaintenancePeriod;
use App\Services\OperationAudit;
use App\Services\PreservedProjectDeletion;
use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\LiteralDirectorySearch;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Response;

/**
 * Maintenance record directory, forms, details, writes and reassignment.
 *
 * Uses the same canonical identity, authorization, validation, and query
 * helpers as before; those helpers remain on OperationsFrontendController
 * during the incremental refactor.
 */
final class MaintenanceRecordPageController extends OperationsFrontendController
{
    public function recordForm(Request $request, int $project, ?int $id = null): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::recordForm($request, $project, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $p = $this->projectChoices($actor)->where('p.id', $project)->first();
        abort_unless($p !== null, 404);
        $record = $id === null ? null : $this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->first();
        abort_if($id !== null && $record === null, 404);
        abort_if($record !== null && ! $this->canWriteRecord($record, $actor), 403);
        $engineers = $this->eligibility->choices($actor, (int) $p->lgu_id)->get();
        if ($record !== null && $record->managing_engineer_id !== null && ! $engineers->contains('id', $record->managing_engineer_id)) {
            $engineers->push((object) ['id' => (int) $record->managing_engineer_id, 'first_name' => $record->first_name, 'last_name' => $record->last_name]);
        }

        return $this->render('MaintenanceProjects/Records/'.($id === null ? 'Create' : 'Edit'), $request, [
            'duplicatePeriod' => $this->duplicatePeriod($request, $actor),
            'project' => $this->projectChoiceData($p), 'engineers' => $engineers,
            'records' => $this->records($actor)->where('m.project_id', $project)->get(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter'])->map(fn (\stdClass $r): array => $this->periodChoiceData($r)),
            'record' => $record === null ? null : $this->recordData($record, $actor), 'canWrite' => true,
            'submitUrl' => self::BASE.'/maintenance-projects/'.$project.'/records'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/maintenance-projects/'.$project.($id === null ? '' : '/records/'.$id),
        ]);
    }

    public function saveRecord(Request $request, int $project, ?int $id = null): RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::saveRecord($request, $project, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        abort_unless($this->projects($actor)->where('p.id', $project)->exists(), 404);
        if ($id !== null) {
            abort_unless($this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->exists(), 404);
        }
        $request->merge(['project_id' => $project]);
        $this->inputAlias($request, 'engineers_id', 'managing_engineer_id');
        $this->write(function () use ($request, $id): void {
            try {
                $this->operations->saveRecord($request, $this->identities, $id);
            } catch (DuplicateMaintenancePeriod $error) {
                if (! $request->expectsJson()) {
                    $request->session()->flash('dd_duplicate_period', $request->only(['project_id', 'maintenance_year', 'quarter']));
                }
                throw $error;
            }
        }, ['managing_engineer_id' => 'engineers_id']);

        $parent = self::BASE.'/maintenance-projects/'.$project;
        $detail = $id === null ? $parent : $parent.'/records/'.$id;

        return redirect($this->editReturn($request, $id === null ? $parent : $detail, [$parent, $detail, self::BASE.'/maintenance-records']))->with('dd_operations_status', 'MaintenanceRecord saved to the database.');
    }

    public function recordShow(Request $request, int $project, int $id): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::recordShow($request, $project, $id);
        }

        $actor = $this->actor($request);
        $r = $this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->first();
        abort_unless($r !== null, 404);
        $p = $this->projects($actor)->where('p.id', $project)->first();
        abort_unless($p !== null, 404);

        return $this->render('MaintenanceProjects/Records/Show', $request, [
            'project' => $this->projectData($p, $actor), 'record' => $this->recordData($r, $actor),
            'monthlyUpdateCreateUrl' => $this->canWriteRecord($r, $actor) ? self::BASE.'/monthly-updates/create?maintenance_id='.$id : null,
            'documents' => $this->documentQuery($actor)->where('d.maintenance_id', $id)->orderByDesc('d.id')->get()->map(fn (\stdClass $d): array => $this->documentData($d, $actor)),
            'updates' => $this->updateQuery($actor)->where('u.maintenance_id', $id)->orderByDesc('u.update_month')->get()->map(fn (\stdClass $u): array => $this->updateData($u, $actor)),
            'canWrite' => $this->canWriteRecord($r, $actor),
            'canReassign' => RoleAccess::managesBusinessData($actor['role']),
            'canUnassign' => false,
            'managerChoices' => RoleAccess::managesBusinessData($actor['role']) ? $this->eligibility->choices($actor, (int) $r->lgu_id)->get() : [],
        ]);
    }

    public function recordIndex(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::recordIndex($request);
        }

        $actor = $this->actor($request);
        $filters = $request->only(['search', 'municipality', 'year', 'quarter', 'status', 'sort'])
            + ['search' => '', 'municipality' => 'all', 'year' => 'all', 'quarter' => 'all', 'status' => 'all', 'sort' => 'newest'];
        $filters['search'] = LiteralDirectorySearch::normalize($filters['search']);
        foreach (['municipality', 'year', 'quarter', 'status'] as $key) {
            $filters[$key] = LiteralDirectorySearch::option($filters[$key]);
        }
        $filters['sort'] = $filters['sort'] === 'oldest' ? 'oldest' : 'newest';
        $q = $this->records($actor);
        if ($filters['search'] !== '') {
            $like = LiteralDirectorySearch::pattern($filters['search']);
            $q->where(fn ($query) => $query->where('p.project_title', 'ilike', $like)
                ->orWhereRaw("concat_ws(' ', e.first_name, e.last_name) ilike ?", [$like])
                ->orWhere('l.municipality_name', 'ilike', $like)
                ->orWhereRaw('CAST(m.id AS text) ilike ?', [$like]));
        }
        foreach (['municipality' => 'rc.lgu_id', 'year' => 'm.maintenance_year', 'quarter' => 'm.quarter', 'status' => 'm.status'] as $key => $column) {
            if (is_string($filters[$key]) && $filters[$key] !== '' && $filters[$key] !== 'all') {
                if (! in_array($key, ['municipality', 'year'], true) || ctype_digit($filters[$key])) {
                    $q->where($column, $filters[$key]);
                }
            }
        }

        $allRecords = $this->records($actor);

        return $this->render('MaintenanceRecords/Index', $request, [
            'totalProjects' => $this->projectChoices($actor)->count(),
            'totalRecords' => (clone $allRecords)->count(),
            'completedRoads' => (clone $allRecords)->whereRaw('LOWER(m.status) = ?', ['completed'])->count(),
            'ongoingRoads' => (clone $allRecords)->whereRaw('LOWER(m.status) IN (?, ?)', ['ongoing', 'in progress'])->count(),
            'records' => $q->orderBy('m.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->recordData($r, $actor)),
            'projects' => $this->projectChoices($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectChoiceData($p)),
            'municipalities' => $this->municipalities($actor)->map(fn (\stdClass $l): array => ['value' => (string) $l->id, 'label' => $l->municipality_name]),
            'years' => $this->records($actor)->reorder()->select('m.maintenance_year')->distinct()->orderByDesc('m.maintenance_year')->pluck('m.maintenance_year'),
            'historyUrl' => RoleAccess::managesBusinessData($actor['role']) && app(PreservedProjectDeletion::class)->available() ? '/dd-phase3/history/records' : null,
            'filters' => $filters, 'canCreate' => $this->writable($actor), 'canDelete' => RoleAccess::canDeleteOperations($actor['role']),
            'canBulkDelete' => RoleAccess::canDeleteOperations($actor['role']), 'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public function recordCreate(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::recordCreate($request);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $projects = $this->projectChoices($actor)->orderBy('p.project_title')->get();
        $choices = $this->eligibility->eligibleChoices($actor)->get()->map(fn (\stdClass $e): array => ['id' => (int) $e->id, 'first_name' => $e->first_name, 'last_name' => $e->last_name])->all();
        // Eligibility does not vary by municipality: send the same Engineer list
        // only once, rather than repeating it for every project.

        return $this->render('MaintenanceProjects/Records/Create', $request, [
            'duplicatePeriod' => $this->duplicatePeriod($request, $actor),
            'projects' => $projects->map(fn (\stdClass $p): array => $this->projectChoiceData($p)), 'engineers' => $choices,
            'records' => $this->records($actor)->get(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter'])->map(fn (\stdClass $r): array => $this->periodChoiceData($r)),
            'canWrite' => true, 'cancelUrl' => self::BASE.'/maintenance-records',
        ]);
    }

    public function reassign(Request $request, int $project, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::managesBusinessData($actor['role']), 403);
        abort_unless($this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->exists(), 404);
        $this->operations->reassignRecord($request, $this->identities, $id);

        return redirect(self::BASE.'/maintenance-projects/'.$project.'/records/'.$id)->with('dd_operations_status', 'ManagingEngineer reassigned.');
    }

    public function deleteRecord(Request $request, int $id): RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::deleteRecord($request, $id);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete maintenance records.');
        app(DeletionChallenge::class)->verify($request, $actor['account_id'], 'record');

        $record = $this->records($actor)->where('m.id', $id)->first();
        $this->deleteEmptyRecords($actor, [$id]);

        $directory = self::BASE.'/maintenance-records';
        $allowed = [$directory];
        if ($record?->project_id !== null) {
            $allowed[] = self::BASE.'/maintenance-projects/'.$record->project_id;
        }

        return redirect($this->editReturn($request, $directory, $allowed))->with('dd_operations_status', 'Maintenance record deleted successfully.');
    }

    public function bulkDeleteRecord(Request $request): RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::bulkDeleteRecord($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete maintenance records.');
        app(DeletionChallenge::class)->verify($request, $actor['account_id'], 'record');

        $validated = $request->validate([
            'record_ids' => ['required', 'array', 'min:1', 'max:100'],
            'record_ids.*' => ['required', 'integer', 'min:1', 'distinct'],
        ]);
        $ids = array_values(array_map('intval', $validated['record_ids']));
        $this->deleteEmptyRecords($actor, $ids);

        return redirect(self::BASE.'/maintenance-records')->with('dd_operations_status', 'Selected maintenance records deleted successfully.');
    }

    /** Delete only empty, attached records; never cascade over private files or preserved history.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  list<int>  $ids
     */
    private function deleteEmptyRecords(array $actor, array $ids): void
    {
        sort($ids);
        try {
            DB::transaction(function () use ($actor, $ids): void {
                $records = DB::table('jairoads_next.maintenance_records')
                    ->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
                abort_unless($records->count() === count($ids), 404);
                foreach ($records as $record) {
                    $id = (int) $record->id;
                    if ($record->project_id === null
                        || DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $id)->exists()
                        || DB::table('jairoads_next.maintenance_documents')->where('maintenance_id', $id)->exists()) {
                        throw ValidationException::withMessages([
                            'delete' => "Maintenance Record #{$id} cannot be deleted while it has related monthly updates or documents, or is preserved history. Remove related data through its authorized workflow first.",
                        ]);
                    }
                }

                foreach ($records as $record) {
                    $id = (int) $record->id;
                    $deleted = DB::table('jairoads_next.maintenance_records')->where('id', $id)->delete();
                    if ($deleted !== 1 || DB::table('jairoads_next.maintenance_records')->where('id', $id)->exists()) {
                        throw ValidationException::withMessages(['delete' => "Maintenance Record #{$id} could not be deleted. No records were removed."]);
                    }
                    app(OperationAudit::class)->record($actor, 'DELETE', 'MaintenanceRecord', $id,
                        'Empty maintenance record deleted after restrictive dependency checks.', [], (array) $record);
                }
            });
        } catch (QueryException $error) {
            if ((string) $error->getCode() === '23503') {
                throw ValidationException::withMessages(['delete' => 'A selected maintenance record is still referenced by other data. No records were removed.']);
            }

            report($error);
            throw ValidationException::withMessages(['delete' => 'Maintenance record deletion failed. No records were removed. Contact an administrator if the problem continues.']);
        }
    }
}
