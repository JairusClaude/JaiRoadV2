<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuditValues;
use App\Services\DeletionChallenge;
use App\Services\DuplicateMaintenancePeriod;
use App\Services\OperationAudit;
use App\Services\PreservedProjectDeletion;
use App\Services\PreviewDataService;
use App\Services\RecordMutationAuthority;
use App\Services\RoleAccess;
use App\Support\LiteralDirectorySearch;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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
            'records' => $this->records($actor)->where('m.project_id', $project)->select(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter'])->get()->map(fn (\stdClass $r): array => $this->periodChoiceData($r)),
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
                    $request->session()->flash('jairoads_duplicate_period', $request->only(['project_id', 'maintenance_year', 'quarter']));
                }
                throw $error;
            }
        }, ['managing_engineer_id' => 'engineers_id']);

        $parent = self::BASE.'/maintenance-projects/'.$project;
        $detail = $id === null ? $parent : $parent.'/records/'.$id;

        return redirect($this->editReturn($request, $id === null ? $parent : $detail, [$parent, $detail, self::BASE.'/maintenance-records']))->with('jairoads_operations_status', 'MaintenanceRecord saved to the database.');
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

        $documentQuery = $this->documentQuery($actor)->where('d.maintenance_id', $id);
        $updateQuery = $this->updateQuery($actor)->where('u.maintenance_id', $id);
        $documentTotal = (clone $documentQuery)->count();
        $updateTotal = (clone $updateQuery)->count();
        $perPage = 12;
        $documentPage = min(max(1, $request->integer('document_page', 1)), max(1, (int) ceil($documentTotal / $perPage)));
        $updatePage = min(max(1, $request->integer('update_page', 1)), max(1, (int) ceil($updateTotal / $perPage)));
        $checkpoints = (clone $updateQuery)->select([])
            ->selectRaw('min(case when u.progress_percentage >= 25 then u.update_month end) as month25, min(case when u.progress_percentage >= 50 then u.update_month end) as month50, min(case when u.progress_percentage >= 75 then u.update_month end) as month75, min(case when u.progress_percentage >= 100 then u.update_month end) as month100')
            ->first();
        $checkpointMonths = [$checkpoints->month25 ?? null, $checkpoints->month50 ?? null, $checkpoints->month75 ?? null, $checkpoints->month100 ?? null];

        return $this->render('MaintenanceProjects/Records/Show', $request, [
            'project' => $this->projectData($p, $actor), 'record' => $this->recordData($r, $actor),
            'milestones' => $this->milestonesEnabled() ? DB::table('jairoads_next.maintenance_milestones')->where('maintenance_id', $id)->orderBy('planned_date')->orderBy('id')->limit(100)->get(['id', 'title', 'planned_date', 'completed_date', 'status', 'version']) : null,
            'milestonesWritable' => $this->milestonesEnabled() && ! config('jairoads_file_deletion.operationally_enabled') && $this->canWriteRecord($r, $actor),
            'monthlyUpdateCreateUrl' => $this->canWriteRecord($r, $actor) ? self::BASE.'/monthly-updates/create?maintenance_id='.$id : null,
            'documents' => $documentQuery->orderByDesc('d.uploaded_at')->orderByDesc('d.id')->forPage($documentPage, $perPage)->get()->map(fn (\stdClass $d): array => $this->documentData($d, $actor)),
            'updates' => $updateQuery->orderByDesc('u.update_month')->orderByDesc('u.id')->forPage($updatePage, $perPage)->get()->map(fn (\stdClass $u): array => $this->updateData($u, $actor)),
            'documentPagination' => ['page' => $documentPage, 'total' => $documentTotal, 'perPage' => $perPage],
            'updatePagination' => ['page' => $updatePage, 'total' => $updateTotal, 'perPage' => $perPage],
            'checkpointMonths' => $checkpointMonths,
            'canWrite' => $this->canWriteRecord($r, $actor),
            'canReassign' => RoleAccess::managesBusinessData($actor['role']),
            'canUnassign' => false,
            'managerChoices' => RoleAccess::managesBusinessData($actor['role']) ? $this->eligibility->choices($actor, (int) $r->lgu_id)->get() : [],
        ]);
    }

    private function milestonesEnabled(): bool
    {
        return config('jairoads_milestones.enabled') === true
            && Schema::hasTable('jairoads_next.maintenance_milestones');
    }

    public function saveMilestone(Request $request, int $project, int $id, ?int $milestone = null): RedirectResponse
    {
        abort_if(self::isPreview($request) || ! $this->milestonesEnabled(), 404);
        // Pilot writes cannot run alongside irreversible project/file deletion.
        abort_if(config('jairoads_file_deletion.operationally_enabled'), 409, 'Milestone writes are unavailable while permanent deletion is enabled.');
        $actor = $this->actor($request);
        $this->writer($actor);
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'planned_date' => ['required', 'date_format:Y-m-d'],
            'completed_date' => ['nullable', 'required_if:status,completed', 'prohibited_unless:status,completed', 'date_format:Y-m-d'],
            'status' => ['required', 'in:planned,completed,cancelled'],
            'version' => [$milestone === null ? 'prohibited' : 'required', 'integer', 'min:1'],
        ]);

        DB::transaction(function () use ($actor, $login, $project, $id, $milestone, $data): void {
            $parent = DB::table('jairoads_next.maintenance_projects')->where('id', $project)->lockForUpdate()->first();
            abort_unless($parent !== null, 404);
            $record = DB::table('jairoads_next.maintenance_records')->where('project_id', $project)->where('id', $id)->lockForUpdate()->first();
            abort_unless($record !== null, 404);
            $lgu = DB::table('jairoads_next.road_coverages')->where('id', $parent->road_coverage_id)->value('lgu_id');
            abort_unless($lgu !== null, 404);
            app(RecordMutationAuthority::class)->lock($login, $actor, (int) $lgu);
            abort_unless($this->canWriteRecord($record, $actor), 403);

            $query = DB::table('jairoads_next.maintenance_milestones')->where('maintenance_id', $id);
            $values = ['title' => trim($data['title']), 'planned_date' => $data['planned_date'], 'completed_date' => $data['completed_date'] ?? null, 'status' => $data['status'], 'updated_by' => $actor['account_id'], 'updated_at' => now()];
            if ($milestone === null) {
                if ($query->count() >= 100) {
                    throw ValidationException::withMessages(['title' => 'This record already has 100 retained milestones.']);
                }
                $newId = (int) DB::table('jairoads_next.maintenance_milestones')->insertGetId($values + ['maintenance_id' => $id, 'created_by' => $actor['account_id'], 'created_at' => now()]);
                app(OperationAudit::class)->record($actor, 'CREATE', 'MaintenanceMilestone', $newId, 'Authorized maintenance milestone created.');

                return;
            }

            $target = $query->where('id', $milestone);
            $before = (clone $target)->lockForUpdate()->first();
            abort_unless($before !== null, 404);
            if ((int) $before->version !== (int) $data['version']) {
                throw ValidationException::withMessages(['version' => 'The milestone changed. Refresh before editing.']);
            }
            $target->update($values + ['version' => (int) $before->version + 1]);
            app(OperationAudit::class)->record($actor, 'UPDATE', 'MaintenanceMilestone', $milestone, 'Authorized maintenance milestone updated.', app(AuditValues::class)->persisted('MaintenanceMilestone', $milestone), (array) $before);
        });

        return redirect(self::BASE.'/maintenance-projects/'.$project.'/records/'.$id)->with('jairoads_operations_status', 'Milestone saved.');
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

        $statistics = $this->records($actor)->select([])
            ->selectRaw("count(*) as total, count(*) filter (where lower(m.status) = 'completed') as completed, count(*) filter (where lower(m.status) in ('ongoing', 'in progress')) as ongoing")
            ->first();

        return $this->render('MaintenanceRecords/Index', $request, [
            'totalProjects' => $this->projectChoices($actor)->count(),
            'totalRecords' => (int) ($statistics->total ?? 0),
            'completedRoads' => (int) ($statistics->completed ?? 0),
            'ongoingRoads' => (int) ($statistics->ongoing ?? 0),
            'records' => $q->orderBy('m.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->recordData($r, $actor)),
            'projects' => [], // The directory uses totalProjects, not the full project catalog.
            'municipalities' => $this->municipalities($actor)->map(fn (\stdClass $l): array => ['value' => (string) $l->id, 'label' => $l->municipality_name]),
            'years' => $this->records($actor)->reorder()->select('m.maintenance_year')->distinct()->orderByDesc('m.maintenance_year')->pluck('m.maintenance_year'),
            'historyUrl' => RoleAccess::managesBusinessData($actor['role']) && app(PreservedProjectDeletion::class)->available() ? '/workspace/history/records' : null,
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
        $choices = $this->eligibility->eligibleChoices($actor)->get()->map(fn (\stdClass $e): array => ['id' => (int) $e->id, 'first_name' => $e->first_name, 'last_name' => $e->last_name])->all();
        // Eligibility does not vary by municipality: send the same Engineer list
        // only once, rather than repeating it for every project.

        return $this->render('MaintenanceProjects/Records/Create', $request, [
            'duplicatePeriod' => $this->duplicatePeriod($request, $actor),
            'projects' => [], 'engineers' => $choices, 'records' => [],
            'projectChoiceUrl' => self::BASE.'/project-filter-choices',
            'periodChoiceUrl' => self::BASE.'/record-period-choices',
            'canWrite' => true, 'cancelUrl' => self::BASE.'/maintenance-records',
        ]);
    }

    public function periodChoices(Request $request): JsonResponse
    {
        abort_if(self::isPreview($request), 404);
        $actor = $this->actor($request);
        $this->writer($actor);
        $input = $request->validate(['project' => ['required', 'integer', 'min:1'], 'year' => ['required', 'integer', 'between:2000,2100']]);
        abort_unless($this->projectChoices($actor)->where('p.id', $input['project'])->exists(), 404);
        $periods = $this->records($actor)->where('m.project_id', $input['project'])->where('m.maintenance_year', $input['year'])
            ->select(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter'])->orderBy('m.quarter')->get()
            ->map(fn (\stdClass $record): array => $this->periodChoiceData($record));

        return response()->json(['data' => $periods])->header('Cache-Control', 'private, no-store');
    }

    public function reassign(Request $request, int $project, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::managesBusinessData($actor['role']), 403);
        abort_unless($this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->exists(), 404);
        $this->operations->reassignRecord($request, $this->identities, $id);

        return redirect(self::BASE.'/maintenance-projects/'.$project.'/records/'.$id)->with('jairoads_operations_status', 'ManagingEngineer reassigned.');
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

        return redirect($this->editReturn($request, $directory, $allowed))->with('jairoads_operations_status', 'Maintenance record deleted successfully.');
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

        return redirect(self::BASE.'/maintenance-records')->with('jairoads_operations_status', 'Selected maintenance records deleted successfully.');
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
