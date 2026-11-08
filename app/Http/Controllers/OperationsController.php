<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\AuditValues;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\DuplicateMaintenancePeriod;
use App\Services\Files\PermanentFileDeletion;
use App\Services\LinkedPasswordUpdater;
use App\Services\ManagingEngineerEligibility;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use App\Services\OperationAudit;
use App\Services\PreservedProjectDeletion;
use App\Services\RecordMutationAuthority;
use App\Services\RoadCoverageGeometry;
use App\Services\RoleAccess;
use App\Services\TwiceYearlyMaintenance;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Final DD module endpoints. public.users is authentication infrastructure only.
 * All business SQL is explicitly jairoads_next qualified and audited.
 */
class OperationsController extends Controller
{
    private const SECTIONS = ['settings', 'roads', 'projects', 'updates', 'documents'];

    /** @return array{account_id:int, role:string, engineer_id:?int} */
    protected function actor(Request $request, AccountIdentityResolver $resolver): array
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('dd_user_account_id') !== null, 403);
        $identity = $resolver->resolve($user);
        abort_unless($identity !== null, 403, 'Your account is unavailable. Please contact your administrator.');

        return $identity;
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    private function managers(array $actor): bool
    {
        return RoleAccess::managesBusinessData($actor['role']);
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    protected function writer(array $actor): void
    {
        abort_unless(RoleAccess::canWriteOperations($actor['role']), 403, 'This role cannot change operational records.');
    }

    private function t(string $table): Builder
    {
        return DB::table('jairoads_next.'.$table);
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array<int>
     */
    private function activeLguIds(array $actor): array
    {
        if ($actor['engineer_id'] === null) {
            return [];
        }

        return $this->t('engineer_lgus')->where('engineer_id', $actor['engineer_id'])
            ->where('is_active', true)->pluck('lgu_id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    private function lguAllowed(array $actor, int $lguId): void
    {
        if ($this->managers($actor)) {
            return;
        }
        if ($actor['role'] === 'Engineer') {
            abort_unless(in_array($lguId, $this->activeLguIds($actor), true), 403, 'An active assignment to this municipality is required.');
        }
    }

    private function projectLgu(int $id): ?int
    {
        $value = $this->t('maintenance_projects as p')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->where('p.id', $id)->value('r.lgu_id');

        return $value === null ? null : (int) $value;
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    private function recordScope(array $actor, int $recordId, bool $write = false): \stdClass
    {
        $row = $this->t('maintenance_records as mr')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
            ->leftJoin('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->where('mr.id', $recordId)->first(['mr.id', 'mr.project_id', 'mr.managing_engineer_id', 'r.lgu_id']);
        abort_unless($row !== null, 404);
        if ($row->project_id === null) {
            abort_unless($this->managers($actor) && app(PreservedProjectDeletion::class)->available()
                && DB::table(PreservedProjectDeletion::CONTEXT)->where('maintenance_id', $recordId)->exists(), 403);
            abort_if($write, 409, 'Detached project history is read-only.');
        } elseif ($actor['role'] === 'Engineer') {
            $this->lguAllowed($actor, (int) $row->lgu_id);
            if ($write) {
                abort_unless((int) $row->managing_engineer_id === (int) $actor['engineer_id'], 403, 'Current managing Engineer required.');
            }
        } elseif ($write) {
            $this->writer($actor);
        }

        return $row;
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  array<string,mixed>  $meta
     * @param  array<string,mixed>  $oldMeta
     */
    protected function audit(array $actor, string $action, string $entity, ?int $id, string $description, array $meta = [], array $oldMeta = []): void
    {
        app(OperationAudit::class)->record($actor, $action, $entity, $id, $description, $meta, $oldMeta);
    }

    /** @param array<string,mixed> $data */
    private function changed(string $entity, \stdClass $row, array $data): bool
    {
        return app(AuditValues::class)->changes($entity, (array) $row, array_replace((array) $row, $data)) !== [[], []];
    }

    protected function done(string $section, string $message): RedirectResponse
    {
        return redirect()->route('jairoads.dd-phase3.show', ['section' => $section])->with('dd_operations_status', $message);
    }

    public function show(string $section, Request $request, AccountIdentityResolver $resolver): Response
    {
        abort_unless(in_array($section, self::SECTIONS, true), 404);
        $actor = $this->actor($request, $resolver);
        $activeLgus = $this->activeLguIds($actor);
        $restricted = $actor['role'] === 'Engineer';
        $roads = $this->t('road_coverages')->orderByDesc('id');
        if ($restricted) {
            $roads->whereIn('lgu_id', $activeLgus);
        }
        $projects = $this->t('maintenance_projects as p')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->orderByDesc('p.id');
        if ($restricted) {
            $projects->whereIn('r.lgu_id', $activeLgus);
        }
        $records = $this->t('maintenance_records as mr')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->orderByDesc('mr.id');
        if ($restricted) {
            $records->whereIn('r.lgu_id', $activeLgus);
        }
        $updates = $this->t('monthly_updates as mu')
            ->leftJoin('jairoads_next.user_accounts as author', 'author.id', '=', 'mu.created_by')
            ->join('jairoads_next.maintenance_records as mr', 'mr.id', '=', 'mu.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->orderByDesc('mu.id');
        if ($restricted) {
            $updates->whereIn('r.lgu_id', $activeLgus);
        }
        $docs = $this->t('maintenance_documents as d')
            ->leftJoin('jairoads_next.user_accounts as uploader', 'uploader.id', '=', 'd.uploaded_by')
            ->join('jairoads_next.maintenance_records as mr', 'mr.id', '=', 'd.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->orderByDesc('d.id');
        if ($restricted) {
            $docs->whereIn('r.lgu_id', $activeLgus);
        }
        $media = $this->t('media as m')
            ->join('jairoads_next.monthly_updates as mu', 'mu.id', '=', 'm.monthly_update_id')
            ->join('jairoads_next.maintenance_records as mr', 'mr.id', '=', 'mu.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->orderByDesc('m.id');
        if ($restricted) {
            $media->whereIn('r.lgu_id', $activeLgus);
        }

        // Project Details uses the complete scoped history; the general listing is paginated separately.
        $maintenanceHistory = collect();
        $maintenanceSchedule = null;
        $managerChoices = collect();
        if ($section === 'projects' && $request->query('view') === 'show') {
            $projectId = (int) $request->query('project');
            $projectLgu = $this->projectLgu($projectId);
            abort_unless($projectLgu !== null, 404);
            $this->lguAllowed($actor, $projectLgu);
            $projects->where('p.id', $projectId);
            $roads->where('id', $this->t('maintenance_projects')->where('id', $projectId)->value('road_coverage_id'));
            $maintenanceHistory = $this->t('maintenance_records as mr')
                ->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'mr.managing_engineer_id')
                ->where('mr.project_id', $projectId)->orderBy('mr.maintenance_year')->orderBy('mr.quarter')->orderBy('mr.id')
                ->get(['mr.id', 'mr.project_id', 'mr.managing_engineer_id', 'mr.maintenance_year', 'mr.quarter',
                    'mr.start_date', 'mr.estimated_duration_days', 'mr.complete_date', 'mr.status', 'mr.description',
                    'e.first_name as manager_first_name', 'e.last_name as manager_last_name']);
            $maintenanceSchedule = app(TwiceYearlyMaintenance::class)->summarize($maintenanceHistory);
            if (RoleAccess::canWriteOperations($actor['role'])) {
                $managerChoices = app(ManagingEngineerEligibility::class)->choices($actor, $projectLgu)->get();
            }
        }
        $account = $this->t('user_accounts')->where('id', $actor['account_id'])->first(['username', 'email', 'account_type', 'is_active']);

        return Inertia::render('dd-phase3/Operations', [
            'managerChoices' => $managerChoices,
            'canUnassign' => $this->managers($actor) && app(PreservedProjectDeletion::class)->available(),
            'maintenanceHistory' => $maintenanceHistory, 'maintenanceSchedule' => $maintenanceSchedule,
            'section' => $section, 'role' => $actor['role'], 'canManage' => $this->managers($actor),
            'engineerId' => $actor['engineer_id'], 'hasAssignment' => count($activeLgus) > 0,
            'capabilities' => RoleAccess::capabilities($actor['role'], count($activeLgus) > 0, $actor['engineer_id'] !== null),
            'identity' => ['username' => (string) $account->username, 'email' => (string) $account->email, 'role' => $actor['role']],
            'lgus' => $this->t('lgus')->when($restricted, fn ($q) => $q->whereIn('id', $activeLgus))->orderBy('id')->limit(300)->get(['id', 'municipality_name']),
            'engineers' => $this->t('engineers')->where('engineer_status', 'Active')->when($restricted, fn ($q) => $q->where('id', $actor['engineer_id']))->orderBy('id')->limit(300)->get(['id', 'first_name', 'last_name']),
            // For manager-initiated RoadCoverage creation, the actual Engineer
            // who prepared the mapped coverage must be chosen explicitly.
            // The manager remains the authenticated audit actor.
            'roadCreatorChoices' => $this->managers($actor)
                ? $this->t('engineer_lgus as el')
                    ->join('jairoads_next.engineers as e', 'e.id', '=', 'el.engineer_id')
                    ->where('el.is_active', true)
                    ->where('e.engineer_status', 'Active')
                    ->orderBy('e.last_name')->orderBy('e.first_name')
                    ->limit(500)
                    ->get(['el.engineer_id as id', 'el.lgu_id', 'e.first_name', 'e.last_name'])
                : collect(),
            'roads' => $roads->limit(300)->get(['id', 'road_name', 'lgu_id', 'kilometers', 'pavement_type', 'state_category', 'created_by', 'geojson']),
            'projects' => $projects->limit(300)->get(['p.id', 'p.project_title', 'p.road_coverage_id', 'p.description', 'p.created_by', 'r.lgu_id']),
            'records' => $records->limit(300)->get(['mr.id', 'mr.project_id', 'mr.managing_engineer_id', 'mr.maintenance_year', 'mr.quarter', 'mr.start_date', 'mr.estimated_duration_days', 'mr.complete_date', 'mr.status', 'mr.description', 'r.lgu_id']),
            'updates' => $updates->limit(300)->get(['author.username as author_name', 'mu.id', 'mu.maintenance_id', 'mu.update_month', 'mu.progress_percentage', 'mu.summary_of_text_reports', 'mr.managing_engineer_id', 'r.lgu_id']),
            'documents' => $docs->limit(300)->get(['uploader.username as uploader_name', 'd.description', 'd.id', 'd.maintenance_id', 'd.document_title', 'd.file_name', 'd.uploaded_at', 'mr.managing_engineer_id']),
            'media' => $media->limit(300)->get(['m.id', 'm.monthly_update_id', 'm.file_name', 'm.file_type', 'mr.managing_engineer_id']),
            'documentsReady' => app(PrivateSupabaseStorage::class)->configured(),
            'mediaReady' => app(PrivateMonthlyMediaStorage::class)->configured(),
            'status' => $request->session()->get('dd_operations_status'),
        ]);
    }

    public function saveRoad(Request $request, AccountIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'road_name' => ['required', 'string', 'max:255'], 'lgu_id' => ['required', 'integer', 'min:1'],
            'kilometers' => ['required', 'numeric', 'min:0'], 'pavement_type' => ['required', Rule::in(['Concrete', 'Asphalt', 'Gravel', 'Earth'])],
            'state_category' => ['required', Rule::in(['Good', 'Fair', 'Bad'])], 'geojson' => [$id === null ? 'required' : 'sometimes', 'json'],
            'correction_reason' => ['nullable', 'string', 'max:5000'],
            // Request-only attribution choice, backed by existing RoadCoverage.CreatedBy.
            // Never changes the 11-entity schema or any business table column.
            'created_by_engineer_id' => [$id === null && $this->managers($actor) ? 'required' : 'prohibited', 'integer', 'min:1'],
        ]);
        $geometry = isset($v['geojson']) ? json_decode($v['geojson'], true) : null;
        // RoadCoverage is mapped road geometry, not a marker/polygon. Preserve
        // line-based GeoJSON wrappers supported by the existing road editor.
        if (array_key_exists('geojson', $v) && ! RoadCoverageGeometry::valid($geometry)) {
            throw ValidationException::withMessages([
                'geojson' => 'Provide nonempty road-line GeoJSON with valid longitude/latitude coordinates.',
            ]);
        }
        abort_unless($this->t('lgus')->where('id', $v['lgu_id'])->exists(), 422, 'LGU not found.');
        $this->lguAllowed($actor, (int) $v['lgu_id']);
        $data = [
            'road_name' => $v['road_name'], 'lgu_id' => (int) $v['lgu_id'], 'kilometers' => $v['kilometers'],
            'pavement_type' => $v['pavement_type'], 'state_category' => $v['state_category'],
            'updated_at' => now(),
        ];
        if (array_key_exists('geojson', $v)) {
            $data['geojson'] = json_encode($geometry, JSON_THROW_ON_ERROR);
        }
        DB::transaction(function () use ($actor, $data, $id, $v, $request, $geometry, $resolver): void {
            // Obtain the road before lifecycle authority: a request waiting for
            // this row must not block deactivation by holding a lifecycle lock.
            $row = $id === null ? null : $this->t('road_coverages')->where('id', $id)
                ->lockForUpdate()->first();
            abort_if($id !== null && $row === null, 404);
            // Other existing workflows take lifecycle before road locks. Never
            // wait in the inverse order: busy lifecycle work must finish first.
            $authority = DB::selectOne('SELECT pg_try_advisory_xact_lock_shared(1927710916) AS acquired');
            abort_unless($authority->acquired === true, 409, 'Account authorization is changing. Retry the road edit.');
            // Freeze the bridge/credentials in password-updater lock order.
            DB::table('public.users')->where('id', $request->user()->getAuthIdentifier())->sharedLock()->first(['id']);
            $account = $this->t('user_accounts')->where('id', $actor['account_id'])->sharedLock()->first(['engineer_id']);
            abort_unless($account !== null, 403);
            if ($account->engineer_id !== null) {
                $this->t('engineers')->where('id', $account->engineer_id)->sharedLock()->first(['id']);
            }
            // Assignment administration locks profile then membership; keep the
            // same order and protect the relevant LGU authorization until commit.
            if ($actor['role'] === 'Engineer') {
                $this->t('engineer_lgus')->where('engineer_id', $account->engineer_id)
                    ->where('lgu_id', $data['lgu_id'])->sharedLock()->first(['is_active']);
            }
            abort_unless($this->actor($request, $resolver) === $actor, 403);
            $this->writer($actor);
            $this->lguAllowed($actor, (int) $data['lgu_id']);
            if ($id === null) {
                // RoadCoverage.CreatedBy is an Engineer FK. Manager-initiated
                // entries require a named, active, LGU-assigned mapping Engineer.
                // The AuditLog records the real Admin/SuperAdmin actor separately.
                if ($this->managers($actor)) {
                    if (empty($v['created_by_engineer_id'])) {
                        throw ValidationException::withMessages([
                            'created_by_engineer_id' => 'Select the active Engineer who prepared this road coverage.',
                        ]);
                    }
                    $engineerId = (int) $v['created_by_engineer_id'];
                    $eligible = $this->t('engineers as e')
                        ->join('jairoads_next.engineer_lgus as el', 'el.engineer_id', '=', 'e.id')
                        ->where('e.id', $engineerId)
                        ->where('e.engineer_status', 'Active')
                        ->where('el.lgu_id', (int) $v['lgu_id'])
                        ->where('el.is_active', true)
                        ->exists();
                    if (! $eligible) {
                        throw ValidationException::withMessages([
                            'created_by_engineer_id' => 'The selected Engineer must be active and assigned to the chosen LGU.',
                        ]);
                    }
                } else {
                    // Engineers can only attribute a creation to themselves.
                    if ($request->exists('created_by_engineer_id')) {
                        throw ValidationException::withMessages([
                            'created_by_engineer_id' => 'Engineer accounts cannot choose another creator.',
                        ]);
                    }
                    $engineerId = $actor['engineer_id'];
                    if ($engineerId === null || ! $this->t('engineers')->where('id', $engineerId)->where('engineer_status', 'Active')->exists()) {
                        throw ValidationException::withMessages(['road_name' => 'An active, linked Engineer profile is required.']);
                    }
                }
                $id2 = (int) $this->t('road_coverages')->insertGetId($data + ['created_by' => $engineerId, 'created_at' => now()]);
                $this->audit($actor, 'CREATE', 'RoadCoverage', $id2, 'Authorized RoadCoverage created.', [
                    'created_by_engineer_id' => $engineerId,
                    'lgu_id' => (int) $v['lgu_id'],
                ]);
            } else {
                $this->lguAllowed($actor, (int) $row->lgu_id);
                if ((int) $row->lgu_id !== (int) $v['lgu_id']) {
                    throw ValidationException::withMessages([
                        'lgu_id' => 'Use Change municipality to review affected records and confirm the municipality transition separately.',
                    ]);
                }
                // Compare actual persisted values under the lock; never trust an
                // 'unchanged' flag. Omitted or identical geometry is not rewritten.
                if (array_key_exists('geojson', $data) && (json_decode($row->geojson, true) === $geometry
                    || app(AuditValues::class)->geometryDigest($row->geojson) === app(AuditValues::class)->geometryDigest($data['geojson']))) {
                    unset($data['geojson']);
                }
                if (! $this->changed('RoadCoverage', $row, $data)) {
                    return;
                }
                $this->t('road_coverages')->where('id', $id)->update($data);
                $this->audit($actor, 'UPDATE', 'RoadCoverage', $id, 'Authorized RoadCoverage updated.',
                    app(AuditValues::class)->persisted('RoadCoverage', $id) + (empty($v['correction_reason']) ? [] : ['correction_reason' => $v['correction_reason']]), (array) $row);
            }
        });

        return $this->done('roads', 'Road coverage saved.');
    }

    public function saveProject(Request $request, AccountIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'project_title' => ['required', 'string', 'max:255'],
            'road_coverage_id' => ['required', 'integer', 'min:1'],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);
        DB::transaction(function () use ($actor, $v, $id): void {
            $road = $this->t('road_coverages')->where('id', $v['road_coverage_id'])->lockForUpdate()->first(['lgu_id']);
            abort_unless($road !== null, 404);
            $this->lguAllowed($actor, (int) $road->lgu_id);
            app(ManagingEngineerEligibility::class)->assertProjectActor($actor, (int) $road->lgu_id);
            $assigned = $this->t('maintenance_projects')->where('road_coverage_id', $v['road_coverage_id']);
            if ($id !== null) {
                $assigned->where('id', '!=', $id);
            }
            if ($assigned->exists()) {
                throw ValidationException::withMessages(['road_coverage_id' => 'This road coverage is already assigned to another project.']);
            }
            if ($id !== null) {
                $existing = $this->t('maintenance_projects')->where('id', $id)->lockForUpdate()->first();
                abort_unless($existing !== null, 404);
                $old = $this->projectLgu($id);
                abort_unless($old !== null, 404);
                $this->lguAllowed($actor, $old);
                if ((int) $existing->road_coverage_id !== (int) $v['road_coverage_id']
                    && $this->t('maintenance_records')->where('project_id', $id)->exists()) {
                    throw ValidationException::withMessages([
                        'road_coverage_id' => 'Road coverage cannot be changed while this project has maintenance history.',
                    ]);
                }
            }
            $data = ['project_title' => $v['project_title'], 'road_coverage_id' => $v['road_coverage_id'],
                'description' => $v['description'] ?? null, 'updated_at' => now()];
            if ($id === null) {
                $pid = (int) $this->t('maintenance_projects')->insertGetId($data + ['created_by' => $actor['account_id'], 'created_at' => now()]);
                $this->audit($actor, 'CREATE', 'MaintenanceProject', $pid, 'Authorized project created.');
            } else {
                if (! $this->changed('MaintenanceProject', $existing, $data)) {
                    return;
                }
                abort_unless($this->t('maintenance_projects')->where('id', $id)->update($data) === 1, 404);
                $this->audit($actor, 'UPDATE', 'MaintenanceProject', $id, 'Authorized project updated.', app(AuditValues::class)->persisted('MaintenanceProject', $id), (array) $existing);
            }
        });

        return $this->done('projects', 'Project saved.');
    }

    public function saveRecord(Request $request, AccountIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'project_id' => ['required', 'integer', 'min:1'],
            'managing_engineer_id' => [$id === null ? 'required' : 'present', $id === null ? 'required' : 'nullable', 'integer', 'min:1'],
            'maintenance_year' => ['required', 'integer', 'between:1900,2100'],
            'quarter' => ['required', Rule::in(['Q1', 'Q2', 'Q3', 'Q4'])],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'estimated_duration_days' => ['required', 'integer', 'min:1'],
            'complete_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'status' => ['required', Rule::in(['Ongoing', 'Completed'])],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);
        if (($v['status'] === 'Completed') !== ! empty($v['complete_date'])) {
            throw ValidationException::withMessages(['complete_date' => 'Completed records require a completion date; ongoing records must not have one.']);
        }
        app(TwiceYearlyMaintenance::class)->validateStart((int) $v['maintenance_year'], $v['quarter'], $v['start_date']);
        if ($actor['role'] === 'Engineer' && (int) $v['managing_engineer_id'] !== (int) $actor['engineer_id']) {
            abort(403, 'Engineer cannot assign another managing Engineer.');
        }
        try {
            DB::transaction(function () use ($actor, $v, $id, $request): void {
                // Serialize all period writes for a project before inspecting complete history.
                $project = $this->t('maintenance_projects')->where('id', $v['project_id'])->lockForUpdate()->first();
                abort_unless($project !== null, 404);
                $lgu = $this->projectLgu((int) $project->id);
                abort_unless($lgu !== null, 404);
                $this->lguAllowed($actor, $lgu);
                abort_unless($v['managing_engineer_id'] === null || $this->t('engineers')->where('id', $v['managing_engineer_id'])->where('engineer_status', 'Active')->exists(), 422, 'Managing Engineer must be active.');
                $data = array_intersect_key($v, array_flip(['project_id', 'managing_engineer_id', 'maintenance_year', 'quarter', 'start_date', 'estimated_duration_days', 'complete_date', 'status', 'description']));
                $data['complete_date'] = $v['complete_date'] ?? null;
                $data['description'] = $v['description'] ?? null;
                $data['updated_at'] = now();
                if ($id === null) {
                    app(ManagingEngineerEligibility::class)->validate($actor, (int) $v['managing_engineer_id'], $lgu);
                    $history = $this->t('maintenance_records')->where('project_id', $project->id)->get(['maintenance_year', 'quarter']);
                    app(TwiceYearlyMaintenance::class)->validateCreation($history, (int) $v['maintenance_year'], $v['quarter']);
                    $rid = (int) $this->t('maintenance_records')->insertGetId($data + ['created_by' => $actor['account_id'], 'created_at' => now()]);
                    $this->audit($actor, 'CREATE', 'MaintenanceRecord', $rid, 'Authorized maintenance record created.');
                } else {
                    $period = $this->t('maintenance_records')->where('id', $id)->lockForUpdate()->first();
                    abort_unless($period !== null, 404);
                    $login = $request->user();
                    abort_unless($login instanceof User, 403);
                    app(RecordMutationAuthority::class)->lock($login, $actor, $lgu);
                    // Scope must come from the locked state, not a pre-wait read.
                    $row = $this->recordScope($actor, $id, true);
                    $manager = $period->managing_engineer_id === null ? null : $this->t('engineers')
                        ->where('id', $period->managing_engineer_id)->sharedLock()->first(['engineer_status']);
                    abort_unless($period->managing_engineer_id === null || $manager?->engineer_status === 'Active', 422, 'Managing Engineer must be active.');
                    if ((int) $row->project_id !== (int) $v['project_id'] || ($row->managing_engineer_id === null ? null : (int) $row->managing_engineer_id) !== ($v['managing_engineer_id'] === null ? null : (int) $v['managing_engineer_id'])) {
                        throw ValidationException::withMessages(['project_id' => 'Changing project or managing Engineer requires separately approved reassignment.']);
                    }
                    if ((int) $period->maintenance_year !== (int) $v['maintenance_year'] || $period->quarter !== $v['quarter']) {
                        throw ValidationException::withMessages(['quarter' => 'The recorded maintenance year and quarter are fixed. Historical schedule corrections require separate review.']);
                    }
                    if (! $this->changed('MaintenanceRecord', $period, $data)) {
                        return;
                    }
                    $this->t('maintenance_records')->where('id', $id)->update($data);
                    $this->audit($actor, 'UPDATE', 'MaintenanceRecord', $id, 'Authorized maintenance record updated.', app(AuditValues::class)->persisted('MaintenanceRecord', $id), (array) $period);
                }
            });
        } catch (QueryException $error) {
            if ($id === null && DuplicateMaintenancePeriod::matchesDatabaseConstraint($error)) {
                throw DuplicateMaintenancePeriod::detected();
            }
            throw $error;
        }

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'projects', 'view' => 'show', 'project' => $v['project_id']])
            ->with('dd_operations_status', 'Maintenance record saved.');
    }

    public function reassignRecord(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        abort_unless($this->managers($actor), 403);
        $data = $request->validate([
            'managing_engineer_id' => ['required', 'integer', 'min:1'],
            'expected_current_manager_id' => ['present', 'nullable', 'integer', 'min:1'],
        ]);
        $projectId = $this->t('maintenance_records')->where('id', $id)->value('project_id');
        abort_unless($projectId !== null, 404);
        DB::transaction(function () use ($request, $resolver, $actor, $data, $id, $projectId): void {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
            // Same project -> record lock order as ordinary record writes.
            abort_unless($this->t('maintenance_projects')->where('id', $projectId)->lockForUpdate()->first(['id']) !== null, 404);
            $account = $this->t('user_accounts')->where('id', $actor['account_id'])->sharedLock()->first(['engineer_id']);
            if ($account?->engineer_id !== null) {
                $this->t('engineers')->where('id', $account->engineer_id)->sharedLock()->first(['id']);
            }
            abort_unless($this->actor($request, $resolver) === $actor, 403);
            $row = $this->t('maintenance_records')->where('id', $id)->lockForUpdate()->first(['project_id', 'managing_engineer_id']);
            abort_unless($row instanceof \stdClass && (int) $row->project_id === (int) $projectId, 404);
            if (($row->managing_engineer_id === null ? null : (int) $row->managing_engineer_id) !== ($data['expected_current_manager_id'] === null ? null : (int) $data['expected_current_manager_id'])) {
                throw ValidationException::withMessages(['expected_current_manager_id' => 'The manager changed while this form was open. Refresh the record before reassigning.']);
            }
            $lguId = $this->projectLgu((int) $projectId);
            abort_unless($lguId !== null, 404);
            app(ManagingEngineerEligibility::class)->validate($actor, (int) $data['managing_engineer_id'], $lguId);
            if ((int) $row->managing_engineer_id === (int) $data['managing_engineer_id']) {
                return;
            }
            $oldManager = $this->t('engineers')->where('id', $row->managing_engineer_id)->first(['first_name', 'last_name']);
            $newManager = $this->t('engineers')->where('id', $data['managing_engineer_id'])->first(['first_name', 'last_name']);
            abort_unless(($row->managing_engineer_id === null || $oldManager instanceof \stdClass) && $newManager instanceof \stdClass, 404);
            $old = ['managing_engineer_id' => $row->managing_engineer_id === null ? null : (int) $row->managing_engineer_id,
                'managing_engineer_name' => $oldManager === null ? null : trim($oldManager->first_name.' '.$oldManager->last_name)];
            $new = ['managing_engineer_id' => (int) $data['managing_engineer_id'],
                'managing_engineer_name' => trim($newManager->first_name.' '.$newManager->last_name)];
            $this->t('maintenance_records')->where('id', $id)->update(['managing_engineer_id' => $new['managing_engineer_id'], 'updated_at' => now()]);
            // Reuse existing UPDATE vocabulary/helper; old/new snapshots retain explicit reassignment history.
            $this->audit($actor, 'UPDATE', 'MaintenanceRecord', $id, 'Administrator explicitly reassigned ManagingEngineer.', $new, $old);
        }, 3);

        return redirect()->route('jairoads.dd-phase3.show', ['section' => 'projects', 'view' => 'show', 'project' => $projectId])
            ->with('dd_operations_status', 'ManagingEngineer reassigned.');
    }

    public function unassignRecord(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        abort_unless($this->managers($actor), 403);
        abort_unless(app(PreservedProjectDeletion::class)->available(), 503, 'Schema-owner setup is required for unassignment.');
        $data = $request->validate(['expected_current_manager_id' => ['present', 'nullable', 'integer', 'min:1']]);
        $projectId = $this->t('maintenance_records')->where('id', $id)->value('project_id');
        abort_unless($projectId !== null, 409, 'Detached history cannot change assignments.');
        DB::transaction(function () use ($request, $resolver, $actor, $data, $id, $projectId): void {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
            abort_unless($this->t('maintenance_projects')->where('id', $projectId)->lockForUpdate()->first(['id']) !== null, 404);
            $row = $this->t('maintenance_records')->where('id', $id)->lockForUpdate()->first(['project_id', 'managing_engineer_id']);
            abort_unless($row !== null && $row->project_id === $projectId, 409);
            $account = $this->t('user_accounts')->where('id', $actor['account_id'])->sharedLock()->first(['engineer_id']);
            if ($account?->engineer_id !== null) {
                $this->t('engineers')->where('id', $account->engineer_id)->sharedLock()->first(['id']);
            }
            abort_unless($this->actor($request, $resolver) === $actor, 403);
            $old = $row->managing_engineer_id === null ? null : (int) $row->managing_engineer_id;
            if ($old !== ($data['expected_current_manager_id'] === null ? null : (int) $data['expected_current_manager_id'])) {
                throw ValidationException::withMessages(['expected_current_manager_id' => 'Manager changed. Refresh before unassigning.']);
            }
            if ($old === null) {
                return;
            }
            $this->t('maintenance_records')->where('id', $id)->update(['managing_engineer_id' => null, 'updated_at' => now()]);
            $this->audit($actor, 'UPDATE', 'MaintenanceRecord', $id,
                'MaintenanceRecord #'.$id.' ManagingEngineer changed from Engineer #'.$old.' to NULL.',
                ['managing_engineer_id' => null], ['managing_engineer_id' => $old]);
        }, 3);

        return back()->with('dd_operations_status', 'ManagingEngineer is NULL (unassigned).');
    }

    public function saveUpdate(Request $request, AccountIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'maintenance_id' => ['required', 'integer', 'min:1'],
            'update_month' => ['required', 'date_format:Y-m'],
            'progress_percentage' => ['required', 'numeric', 'between:0,100'],
            'summary_of_text_reports' => ['nullable', 'string', 'max:20000'],
        ]);
        $parent = $this->recordScope($actor, (int) $v['maintenance_id'], true);
        DB::transaction(function () use ($request, $resolver, $actor, $parent, $v, $id): void {
            // Match reassignment's project -> record lock order. Authorization
            // checked before a lock wait is not authority to save after it.
            abort_unless($this->t('maintenance_projects')->where('id', $parent->project_id)->lockForUpdate()->first(['id']) !== null, 404);
            $record = $this->t('maintenance_records')->where('id', $v['maintenance_id'])->lockForUpdate()->first(['id', 'project_id']);
            abort_unless($record !== null && (int) $record->project_id === (int) $parent->project_id, 404);
            $lgu = $this->projectLgu((int) $record->project_id);
            abort_unless($lgu !== null, 404);
            $login = $request->user();
            abort_unless($login instanceof User, 403);
            app(RecordMutationAuthority::class)->lock($login, $actor, $lgu);
            abort_unless($this->actor($request, $resolver) === $actor, 403);
            $this->recordScope($actor, (int) $record->id, true);
            $duplicate = $this->t('monthly_updates')->where('maintenance_id', $v['maintenance_id'])->where('update_month', $v['update_month']);
            if ($id !== null) {
                $duplicate->where('id', '!=', $id);
            }
            if ($duplicate->exists()) {
                throw ValidationException::withMessages(['update_month' => 'An update already exists for this maintenance record and month.']);
            }
            $data = ['maintenance_id' => (int) $v['maintenance_id'], 'update_month' => $v['update_month'],
                'progress_percentage' => $v['progress_percentage'],
                'summary_of_text_reports' => $v['summary_of_text_reports'] ?? null, 'updated_at' => now()];
            if ($id === null) {
                if ($this->t('monthly_updates')->where('maintenance_id', $v['maintenance_id'])->where('update_month', $v['update_month'])->exists()) {
                    throw ValidationException::withMessages(['update_month' => 'An update already exists for this maintenance record and month.']);
                }
                $uid = (int) $this->t('monthly_updates')->insertGetId($data + ['created_by' => $actor['account_id'], 'created_at' => now()]);
                $this->audit($actor, 'CREATE', 'MonthlyUpdate', $uid, 'Authorized monthly update created.');
            } else {
                $old = $this->t('monthly_updates')->where('id', $id)->lockForUpdate()->first();
                abort_unless($old !== null, 404);
                $this->recordScope($actor, (int) $old->maintenance_id, true);
                abort_unless((int) $old->maintenance_id === (int) $v['maintenance_id'], 422, 'Cannot move monthly update to another maintenance record.');
                if (! $this->changed('MonthlyUpdate', $old, $data)) {
                    return;
                }
                $this->t('monthly_updates')->where('id', $id)->update($data);
                $this->audit($actor, 'UPDATE', 'MonthlyUpdate', $id, 'Authorized monthly update revised.', app(AuditValues::class)->persisted('MonthlyUpdate', $id), (array) $old);
            }
        });

        return $this->done('updates', 'Monthly update saved.');
    }

    public function saveSettings(Request $request, AccountIdentityResolver $resolver, LinkedPasswordUpdater $passwords): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        // Preserve the existing manager-only Settings permission.
        abort_unless($this->managers($actor), 403, 'Account changes require administrator authorization.');
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $v = $request->validate([
            'username' => ['required', 'string', 'min:3', 'max:100', 'regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'current_password' => ['required', 'string'],
            'password' => ['nullable', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $username = strtolower(trim($v['username']));
        abort_unless(Hash::check($v['current_password'], $login->password), 422, 'Current password is incorrect.');
        DB::transaction(function () use ($actor, $username, $v, $login, $passwords): void {
            DB::select('SELECT pg_advisory_xact_lock(1927710963)');
            if (! empty($v['password'])) {
                $passwords->change($login, $v['current_password'], $v['password']);
            }
            $account = $this->t('user_accounts')->where('id', $actor['account_id'])->lockForUpdate()->first(['id', 'username']);
            abort_unless($account !== null, 403);
            if ($this->t('user_accounts')->whereRaw('LOWER(username) = ?', [$username])->where('id', '!=', $actor['account_id'])->exists()) {
                throw ValidationException::withMessages(['username' => 'Username is already in use.']);
            }
            $data = ['username' => $username, 'updated_at' => now()];
            if ($account->username !== $username) {
                $this->t('user_accounts')->where('id', $actor['account_id'])->update($data);
                $this->audit($actor, 'UPDATE', 'UserAccount', $actor['account_id'], 'Account holder updated approved username; no credentials logged.', ['username' => $username], ['username' => $account->username]);
            }
        });

        return $this->done('settings', 'Settings saved. Sign in again if you changed your password.');
    }

    /** Update approved MaintenanceDocument metadata; the private file and parent stay unchanged. */
    public function updateDocument(Request $request, AccountIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'document_title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);
        DB::transaction(function () use ($actor, $id, $v, $request, $resolver): void {
            $parent = $this->t('maintenance_documents')->where('id', $id)->first(['maintenance_id']);
            abort_unless($parent !== null, 404);
            $this->lockUploadAuthorization($request, $resolver, $actor, (int) $parent->maintenance_id);
            $document = $this->t('maintenance_documents')->where('id', $id)->lockForUpdate()->first();
            abort_unless($document !== null && $document->maintenance_id === $parent->maintenance_id, 409);
            // Engineer must be the ManagingEngineer with an active LGU assignment.
            $this->recordScope($actor, (int) $document->maintenance_id, true);
            app(PermanentFileDeletion::class)->assertNotPending('document', $id);
            $data = ['document_title' => $v['document_title'],
                'description' => $v['description'] ?? null,
                'updated_at' => now()];
            if (! $this->changed('MaintenanceDocument', $document, $data)) {
                return;
            }
            $this->t('maintenance_documents')->where('id', $id)->update($data);
            $this->audit($actor, 'UPDATE', 'MaintenanceDocument', $id, 'Approved document metadata revised.', app(AuditValues::class)->persisted('MaintenanceDocument', $id), (array) $document);
        });

        return $this->done('documents', 'Document details updated.');
    }

    /**
     * Recheck after external Storage I/O, before metadata commits.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    private function lockUploadAuthorization(Request $request, AccountIdentityResolver $resolver, array $actor, int $recordId): void
    {
        // Coordinate with lifecycle revocation, then use the reassignment lock order.
        DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
        $projectId = $this->t('maintenance_records')->where('id', $recordId)->value('project_id');
        abort_unless($projectId !== null, 404);
        abort_unless($this->t('maintenance_projects')->where('id', $projectId)->sharedLock()->first(['id']) !== null, 404);
        abort_unless($this->t('maintenance_records')->where('id', $recordId)->sharedLock()->first(['id']) !== null, 404);
        abort_unless($this->actor($request, $resolver) === $actor, 403);
        $this->recordScope($actor, $recordId, true);
        if ($actor['role'] === 'Engineer') {
            $lgu = $this->projectLgu((int) $projectId);
            abort_unless($lgu !== null && $actor['engineer_id'] !== null, 403);
            app(ManagingEngineerEligibility::class)->validate($actor, $actor['engineer_id'], $lgu);
        }
    }

    public function uploadDocument(Request $request, AccountIdentityResolver $resolver, PrivateSupabaseStorage $storage): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate(['maintenance_id' => ['required', 'integer', 'min:1'],
            'document_title' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:5000'],
            'file' => ['required', 'file', 'max:20480', 'mimes:pdf,docx,xlsx,pptx']]);
        $this->recordScope($actor, (int) $v['maintenance_id'], true);
        if (! $storage->configured()) {
            throw ValidationException::withMessages(['file' => 'Document uploads are temporarily unavailable. Contact your administrator.']);
        }
        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $path = 'maintenance-records/'.(int) $v['maintenance_id'].'/'.(string) Str::uuid().'.'.$ext;
        $storage->upload($file, $path);
        try {
            DB::transaction(function () use ($request, $resolver, $actor, $v, $file, $path): void {
                $this->lockUploadAuthorization($request, $resolver, $actor, (int) $v['maintenance_id']);
                $id = (int) $this->t('maintenance_documents')->insertGetId([
                    'maintenance_id' => (int) $v['maintenance_id'], 'document_title' => $v['document_title'],
                    'description' => $v['description'] ?? null, 'file_name' => basename($file->getClientOriginalName()),
                    'file_path' => $path, 'uploaded_by' => $actor['account_id'], 'uploaded_at' => now(), 'updated_at' => now(),
                ]);
                $this->audit($actor, 'CREATE', 'MaintenanceDocument', $id, 'Formal maintenance document uploaded.');
            });
        } catch (\Throwable $e) {
            try {
                $storage->removeAfterFailure($path);
            } catch (\Throwable $cleanup) {
                report($cleanup);
            }
            throw $e;
        }

        return $this->done('documents', 'Document uploaded.');
    }

    public function uploadMedia(Request $request, AccountIdentityResolver $resolver, PrivateMonthlyMediaStorage $storage): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate(['monthly_update_id' => ['required', 'integer', 'min:1'],
            'file' => ['required', 'file', 'max:20480', 'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm']]);
        $update = $this->t('monthly_updates')->where('id', $v['monthly_update_id'])->first(['maintenance_id']);
        abort_unless($update !== null, 404);
        $this->recordScope($actor, (int) $update->maintenance_id, true);
        if (! $storage->configured()) {
            throw ValidationException::withMessages(['file' => 'Evidence uploads are temporarily unavailable. Contact your administrator.']);
        }
        $file = $request->file('file');
        $mime = (string) $file->getMimeType();
        $ext = match ($mime) {
            'image/jpeg' => 'jpg','image/png' => 'png','image/webp' => 'webp','video/mp4' => 'mp4','video/webm' => 'webm',
            default => throw ValidationException::withMessages(['file' => 'Unsupported media MIME type.']),
        };
        $path = 'monthly-updates/'.(int) $v['monthly_update_id'].'/'.(string) Str::uuid().'.'.$ext;
        $storage->upload($file, $path);
        try {
            DB::transaction(function () use ($request, $resolver, $actor, $v, $file, $path, $mime, $update): void {
                $this->lockUploadAuthorization($request, $resolver, $actor, (int) $update->maintenance_id);
                $currentUpdate = $this->t('monthly_updates')->where('id', $v['monthly_update_id'])->sharedLock()->first(['maintenance_id']);
                abort_unless($currentUpdate !== null && (int) $currentUpdate->maintenance_id === (int) $update->maintenance_id, 409);
                $id = (int) $this->t('media')->insertGetId([
                    'monthly_update_id' => (int) $v['monthly_update_id'], 'file_name' => basename($file->getClientOriginalName()),
                    'file_path' => $path, 'file_type' => $mime, 'uploaded_by' => $actor['account_id'], 'created_at' => now(),
                ]);
                $this->audit($actor, 'CREATE', 'Media', $id, 'MonthlyUpdate media evidence uploaded.');
            });
        } catch (\Throwable $e) {
            try {
                $storage->removeAfterFailure($path);
            } catch (\Throwable $cleanup) {
                report($cleanup);
            }
            throw $e;
        }

        return $this->done('updates', 'Evidence uploaded.');
    }

    public function deleteEntity(Request $request, AccountIdentityResolver $resolver, string $entity, int $id): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        abort_unless($this->managers($actor), 403, 'Only Admin/SuperAdmin may delete approved entities.');
        if ($entity === 'projects') {
            $v = $request->validate(['confirmation_token' => ['required', 'string']]);
            $login = $request->user();
            abort_unless($login instanceof User, 403);
            app(PreservedProjectDeletion::class)->confirm($login, $id, $v['confirmation_token']);

            return $this->done('projects', 'Project deleted; maintenance history and files preserved.');
        }
        $allowed = ['roads' => ['road_coverages', 'RoadCoverage'],
            'projects' => ['maintenance_projects', 'MaintenanceProject'],
            'records' => ['maintenance_records', 'MaintenanceRecord'],
            'updates' => ['monthly_updates', 'MonthlyUpdate']];
        abort_unless(isset($allowed[$entity]), 404);
        [$table,$type] = $allowed[$entity];
        DB::transaction(function () use ($actor, $id, $table, $type): void {
            $row = $this->t($table)->where('id', $id)->lockForUpdate()->first();
            abort_unless($row !== null, 404);
            try {
                $this->t($table)->where('id', $id)->delete();
            } catch (QueryException) {
                throw ValidationException::withMessages(['delete' => 'This item is still referenced by other records and cannot be deleted.']);
            }
            $this->audit($actor, 'DELETE', $type, $id, 'Authorized entity removed after restrictive FK check.', [], (array) $row);
        });
        $section = match ($entity) {
            'roads' => 'roads','projects','records' => 'projects','updates' => 'updates'
        };

        return $this->done($section, 'Item deleted.');
    }

    public function fileRemovalReview(Request $request, PermanentFileDeletion $deletions, string $kind, int $id): JsonResponse
    {
        $login = $request->user();
        abort_unless($login instanceof User, 403);

        return response()->json($deletions->review($login, $kind, $id))->header('Cache-Control', 'private, no-store');
    }

    public function deleteFile(Request $request, AccountIdentityResolver $resolver, PermanentFileDeletion $deletions, string $kind, int $id): JsonResponse
    {
        abort_unless($this->managers($this->actor($request, $resolver)), 403);
        $request->validate(array_fill_keys(['file_path', 'file_name', 'bucket', 'storage_origin', 'role', 'lgu_id'], ['prohibited']));
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        try {
            $result = $deletions->delete($login, $kind, $id);
        } catch (QueryException) {
            return response()->json(['state' => 'unconfirmed', 'message' => 'Deletion could not be started or confirmed. Retry or contact an administrator.'], 503)->header('Cache-Control', 'private, no-store');
        }

        return response()->json($result, $result['state'] === 'completed' ? 200 : 202)->header('Cache-Control', 'private, no-store');
    }

    public function download(Request $request, AccountIdentityResolver $resolver, string $kind, int $id, PrivateSupabaseStorage $documents, PrivateMonthlyMediaStorage $media): HttpResponse
    {
        abort_unless(in_array($kind, ['document', 'media'], true), 404);
        $actor = $this->actor($request, $resolver);
        if ($kind === 'document') {
            $row = $this->t('maintenance_documents')->where('id', $id)->first(['maintenance_id', 'file_name', 'file_path']);
            abort_unless($row !== null, 404);
            $this->recordScope($actor, (int) $row->maintenance_id);
            app(PermanentFileDeletion::class)->assertNotPending('document', $id);
            $result = $documents->fetch((string) $row->file_path);
            $mime = match (strtolower(pathinfo($row->file_name, PATHINFO_EXTENSION))) {
                'pdf' => 'application/pdf','docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                default => 'application/octet-stream',
            };
        } else {
            $row = $this->t('media as m')->join('jairoads_next.monthly_updates as mu', 'mu.id', '=', 'm.monthly_update_id')
                ->where('m.id', $id)->first(['mu.maintenance_id', 'm.file_name', 'm.file_path', 'm.file_type']);
            abort_unless($row !== null, 404);
            $this->recordScope($actor, (int) $row->maintenance_id);
            app(PermanentFileDeletion::class)->assertNotPending('media', $id);
            $result = $media->fetch((string) $row->file_path);
            $mime = (string) $row->file_type;
        }
        $filename = basename(str_replace(['\\', '/'], '', (string) $row->file_name));

        return response($result->body(), 200, [
            'Content-Type' => $mime, 'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Content-Disposition' => "attachment; filename*=UTF-8''".rawurlencode($filename),
        ]);
    }
}
