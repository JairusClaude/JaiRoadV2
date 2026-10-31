<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdRoleAccess;
use App\Services\DataDictionary\ManagingEngineerEligibility;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Canonical read projections for the reviewed frontend. Writes delegate to the
 * verified DD operations; legacy IDs, preview sessions and public business data
 * are never translated into canonical identities.
 *
 * @phpstan-type Actor array{account_id:int,role:string,engineer_id:?int}
 */
final class DdFrontendController extends Controller
{
    private const BASE = '/dd-phase3/ui';

    /** @var array<int,bool> */
    private array $writeAccess = [];

    public function __construct(
        private DataDictionaryIdentityResolver $identities,
        private DdOperationsController $operations,
        private ManagingEngineerEligibility $eligibility,
        private PrivateSupabaseStorage $documents,
        private PrivateMonthlyMediaStorage $media,
    ) {}

    /** @return Actor */
    private function actor(Request $request): array
    {
        $login = $request->user();
        abort_unless($login instanceof User && $login->getAttribute('dd_user_account_id') !== null, 403);
        $actor = $this->identities->resolve($login);
        abort_unless($actor !== null, 403, 'Your account is unavailable. Contact your administrator.');

        return $actor;
    }

    /** @param Actor $actor */
    private function scope(Builder $query, array $actor): Builder
    {
        if ($actor['role'] === 'Engineer') {
            $query->whereIn('rc.lgu_id', DB::table('jairoads_next.engineer_lgus')
                ->select('lgu_id')->where('engineer_id', $actor['engineer_id'])->where('is_active', true));
        }

        return $query;
    }

    /** @param Actor $actor */
    private function writable(array $actor): bool
    {
        return $this->writeAccess[$actor['account_id']] ??= DdRoleAccess::managesBusinessData($actor['role'])
            || ($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null
                && DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $actor['engineer_id'])->where('is_active', true)->exists());
    }

    /** @param Actor $actor */
    private function writer(array $actor): void
    {
        abort_unless($this->writable($actor), 403);
    }

    /** @param Actor $actor
     * @return Collection<int,\stdClass>
     */
    private function municipalities(array $actor): Collection
    {
        return DB::table('jairoads_next.lgus')->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->whereIn('id',
            DB::table('jairoads_next.engineer_lgus')->select('lgu_id')->where('engineer_id', $actor['engineer_id'])->where('is_active', true)))
            ->orderBy('municipality_name')->get(['id', 'municipality_name']);
    }

    /** @param array<string,mixed> $props */
    private function render(string $component, Request $request, array $props): Response
    {
        return Inertia::render($component, $props + [
            'canonicalFrontend' => true,
            'jairoadsIdentity' => ['role' => strtolower($this->actor($request)['role'])],
            'status' => $request->session()->get('dd_operations_status'),
        ]);
    }

    /** @param Actor $actor */
    private function roads(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.road_coverages as rc')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'rc.created_by')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id'), $actor)
            ->select(['rc.*', 'l.municipality_name', 'e.first_name', 'e.last_name', 'p.id as project_id', 'p.project_title']);
    }

    /** @return array<string,mixed> */
    private function roadData(\stdClass $row): array
    {
        return [
            'id' => (int) $row->id, 'road_name' => $row->road_name,
            // Frontend response alias only; the canonical column remains lgu_id.
            'lgus_id' => (int) $row->lgu_id, 'lgu' => ['id' => (int) $row->lgu_id, 'municipality_name' => $row->municipality_name],
            'kilometers' => $row->kilometers, 'pavement_type' => $row->pavement_type, 'state_category' => $row->state_category,
            'geojson' => json_decode($row->geojson, true, 512, JSON_THROW_ON_ERROR), 'created_by' => (int) $row->created_by,
            'created_at' => $row->created_at, 'updated_at' => $row->updated_at,
        ];
    }

    public function roadIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $filters = $request->only(['search', 'municipality', 'condition', 'pavement', 'sort'])
            + ['search' => '', 'municipality' => 'all', 'condition' => 'all', 'pavement' => 'all', 'sort' => 'newest'];
        $query = $this->roads($actor);
        if (is_string($filters['search']) && $filters['search'] !== '') {
            $query->where('rc.road_name', 'ilike', '%'.substr($filters['search'], 0, 255).'%');
        }
        foreach (['municipality' => 'rc.lgu_id', 'condition' => 'rc.state_category', 'pavement' => 'rc.pavement_type'] as $key => $column) {
            if (is_string($filters[$key]) && $filters[$key] !== '' && $filters[$key] !== 'all') {
                if ($key !== 'municipality' || ctype_digit($filters[$key])) {
                    $query->where($column, $filters[$key]);
                }
            }
        }
        $query->orderBy(in_array($filters['sort'], ['name-asc', 'name-desc'], true) ? 'rc.road_name' : 'rc.id',
            in_array($filters['sort'], ['oldest', 'name-asc'], true) ? 'asc' : 'desc');

        return $this->render('RoadCoverages/Index', $request, [
            'coverages' => $query->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->roadData($r)),
            'municipalities' => $this->municipalities($actor), 'filters' => $filters, 'canEdit' => $this->writable($actor),
        ]);
    }

    public function roadShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $road = $this->roads($actor)->where('rc.id', $id)->first();
        abort_unless($road !== null, 404);

        return $this->render('RoadCoverages/Show', $request, [
            'coverage' => $this->roadData($road), 'createdByName' => trim($road->first_name.' '.$road->last_name),
            'associatedProject' => $road->project_id === null ? null : ['id' => (int) $road->project_id, 'project_title' => $road->project_title],
            'canEdit' => $this->writable($actor), 'backUrl' => self::BASE.'/road-coverages',
            'municipalities' => $this->municipalities($actor),
        ]);
    }

    public function roadForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $road = $id === null ? null : $this->roads($actor)->where('rc.id', $id)->first();
        abort_if($id !== null && $road === null, 404);
        $creators = DB::table('jairoads_next.engineer_lgus as a')
            ->join('jairoads_next.engineers as e', 'e.id', '=', 'a.engineer_id')
            ->where('a.is_active', true)->where('e.engineer_status', 'Active')
            ->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->where('e.id', $actor['engineer_id']))
            ->orderBy('e.last_name')->get(['e.id', 'a.lgu_id', 'e.first_name', 'e.last_name']);

        return $this->render('RoadCoverages/'.($id === null ? 'Create' : 'Edit'), $request, [
            'coverage' => $road === null ? null : $this->roadData($road),
            'municipalities' => $this->municipalities($actor), 'roadCreatorChoices' => $creators,
            'requiresCreator' => $id === null && DdRoleAccess::managesBusinessData($actor['role']),
            'referenceCoverages' => $this->roads($actor)->orderByDesc('rc.id')->get()->map(fn (\stdClass $r): array => $this->roadData($r)),
            'mapServices' => ['routing' => config('jairoads_maps.routing'), 'geocoding' => config('jairoads_maps.geocoding')],
            'canEdit' => true, 'cancelUrl' => self::BASE.'/road-coverages'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function saveRoad(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        $request->merge(['lgu_id' => $request->input('lgus_id')]);
        if ($request->exists('geojson')) {
            $geometry = $request->input('geojson');
            $request->merge(['geojson' => is_array($geometry) ? json_encode($geometry, JSON_THROW_ON_ERROR) : $geometry]);
        }
        $this->write(fn () => $this->operations->saveRoad($request, $this->identities, $id), ['lgu_id' => 'lgus_id']);

        return redirect(self::BASE.'/road-coverages'.($id === null ? '' : '/'.$id))->with('dd_operations_status', 'Road coverage saved to the database.');
    }

    /** @param Actor $actor */
    private function projects(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.maintenance_projects as p')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'p.created_by'), $actor)
            ->select(['p.*', 'rc.road_name', 'rc.lgu_id', 'rc.geojson', 'l.municipality_name', 'a.username as creator_name'])
            ->selectSub(DB::table('jairoads_next.maintenance_records as c')->selectRaw('count(*)')->whereColumn('c.project_id', 'p.id'), 'record_count');
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    private function projectData(\stdClass $p, array $actor): array
    {
        return ['id' => (int) $p->id, 'project_title' => $p->project_title, 'description' => $p->description,
            'road_coverage_id' => (int) $p->road_coverage_id, 'road_name' => $p->road_name, 'municipality' => $p->municipality_name,
            'created_by' => $p->creator_name, 'created_at' => $p->created_at, 'updated_at' => $p->updated_at,
            'maintenance_records_count' => (int) $p->record_count, 'can_edit' => $this->writable($actor), 'can_delete' => false,
            'geojson' => json_decode($p->geojson, true, 512, JSON_THROW_ON_ERROR)];
    }

    public function projectIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $filters = ['search' => $request->string('search')->toString(), 'municipality' => $request->string('municipality', 'all')->toString(), 'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->projects($actor)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
        if (ctype_digit($filters['municipality'])) {
            $q->where('rc.lgu_id', $filters['municipality']);
        }

        return $this->render('MaintenanceProjects/Index', $request, [
            'projects' => $q->orderBy('p.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'municipalities' => $this->municipalities($actor), 'filters' => $filters,
            'integration' => ['ready' => true, 'message' => null], 'canCreate' => $this->writable($actor), 'canBulkDelete' => false,
        ]);
    }

    public function projectForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $p = $id === null ? null : $this->projects($actor)->where('p.id', $id)->first();
        abort_if($id !== null && $p === null, 404);

        return $this->render('MaintenanceProjects/'.($id === null ? 'Create' : 'Edit'), $request, [
            'project' => $p === null ? null : $this->projectData($p, $actor),
            'coverages' => $this->roads($actor)->where(fn (Builder $q) => $q->whereNull('p.id')->when($id !== null, fn (Builder $q) => $q->orWhere('p.id', $id)))
                ->orderBy('rc.road_name')->get()->map(fn (\stdClass $r): array => ['id' => (int) $r->id, 'road_name' => $r->road_name,
                    'municipality' => $r->municipality_name, 'kilometers' => $r->kilometers, 'assigned' => false, 'geojson' => json_decode($r->geojson, true, 512, JSON_THROW_ON_ERROR)]),
            'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public function saveProject(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        $this->operations->saveProject($request, $this->identities, $id);

        return redirect(self::BASE.'/maintenance-projects'.($id === null ? '' : '/'.$id))->with('dd_operations_status', 'Maintenance Project saved to the database.');
    }

    /** @param Actor $actor */
    private function records(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.maintenance_records as m')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->join('jairoads_next.engineers as e', 'e.id', '=', 'm.managing_engineer_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'm.created_by'), $actor)
            ->select(['m.*', 'p.project_title', 'rc.lgu_id', 'l.municipality_name', 'e.first_name', 'e.last_name', 'a.username as creator_name']);
    }

    /** @param Actor $actor */
    private function canWriteRecord(\stdClass $row, array $actor): bool
    {
        return $this->writable($actor) && ($actor['role'] !== 'Engineer' || (int) $row->managing_engineer_id === $actor['engineer_id']);
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    private function recordData(\stdClass $r, array $actor): array
    {
        $url = self::BASE.'/maintenance-projects/'.$r->project_id.'/records/'.$r->id;

        return ['id' => (int) $r->id, 'project_id' => (int) $r->project_id, 'year' => (int) $r->maintenance_year,
            'quarter' => $r->quarter, 'status' => $r->status, 'engineers_id' => (int) $r->managing_engineer_id,
            'managing_engineer' => ['id' => (int) $r->managing_engineer_id, 'first_name' => $r->first_name, 'last_name' => $r->last_name],
            'start_date' => $r->start_date, 'estimated_duration_days' => (int) $r->estimated_duration_days, 'complete_date' => $r->complete_date,
            'description' => $r->description, 'created_by' => $r->creator_name, 'created_at' => $r->created_at, 'updated_at' => $r->updated_at,
            'details_url' => $url, 'edit_url' => $this->canWriteRecord($r, $actor) ? $url.'/edit' : null, 'delete_url' => null,
            'project' => ['id' => (int) $r->project_id, 'project_title' => $r->project_title, 'municipality' => $r->municipality_name]];
    }

    public function projectShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $p = $this->projects($actor)->where('p.id', $id)->first();
        abort_unless($p !== null, 404);

        return $this->render('MaintenanceProjects/Show', $request, ['project' => $this->projectData($p, $actor),
            'records' => $this->records($actor)->where('m.project_id', $id)->orderByDesc('m.maintenance_year')->orderByDesc('m.quarter')->get()->map(fn (\stdClass $r): array => $this->recordData($r, $actor)),
            'recordCreateUrl' => $this->writable($actor) ? self::BASE.'/maintenance-projects/'.$id.'/records/create' : null,
            'expandedYear' => $request->integer('record_year', (int) date('Y'))]);
    }

    public function recordForm(Request $request, int $project, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $p = $this->projects($actor)->where('p.id', $project)->first();
        abort_unless($p !== null, 404);
        $record = $id === null ? null : $this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->first();
        abort_if($id !== null && $record === null, 404);
        abort_if($record !== null && ! $this->canWriteRecord($record, $actor), 403);
        $engineers = $this->eligibility->choices($actor, (int) $p->lgu_id)->get();
        if ($record !== null && ! $engineers->contains('id', $record->managing_engineer_id)) {
            $engineers->push((object) ['id' => (int) $record->managing_engineer_id, 'first_name' => $record->first_name, 'last_name' => $record->last_name]);
        }

        return $this->render('MaintenanceProjects/Records/'.($id === null ? 'Create' : 'Edit'), $request, [
            'project' => $this->projectData($p, $actor), 'engineers' => $engineers,
            'records' => $this->records($actor)->where('m.project_id', $project)->get()->map(fn (\stdClass $r): array => $this->recordData($r, $actor)),
            'record' => $record === null ? null : $this->recordData($record, $actor), 'canWrite' => true,
            'submitUrl' => self::BASE.'/maintenance-projects/'.$project.'/records'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/maintenance-projects/'.$project.($id === null ? '' : '/records/'.$id),
        ]);
    }

    public function saveRecord(Request $request, int $project, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        abort_unless($this->projects($actor)->where('p.id', $project)->exists(), 404);
        if ($id !== null) {
            abort_unless($this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->exists(), 404);
        }
        $request->merge(['project_id' => $project, 'managing_engineer_id' => $request->input('engineers_id')]);
        $this->write(fn () => $this->operations->saveRecord($request, $this->identities, $id), ['managing_engineer_id' => 'engineers_id']);

        return redirect(self::BASE.'/maintenance-projects/'.$project)->with('dd_operations_status', 'MaintenanceRecord saved to the database.');
    }

    public function recordShow(Request $request, int $project, int $id): Response
    {
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
            'canReassign' => DdRoleAccess::managesBusinessData($actor['role']),
            'managerChoices' => DdRoleAccess::managesBusinessData($actor['role']) ? $this->eligibility->choices($actor, (int) $r->lgu_id)->get() : [],
        ]);
    }

    public function recordIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $filters = $request->only(['search', 'municipality', 'year', 'quarter', 'status', 'sort'])
            + ['search' => '', 'municipality' => 'all', 'year' => 'all', 'quarter' => 'all', 'status' => 'all', 'sort' => 'newest'];
        $q = $this->records($actor);
        if (is_string($filters['search']) && $filters['search'] !== '') {
            $q->where('p.project_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%');
        }
        foreach (['municipality' => 'rc.lgu_id', 'year' => 'm.maintenance_year', 'quarter' => 'm.quarter', 'status' => 'm.status'] as $key => $column) {
            if (is_string($filters[$key]) && $filters[$key] !== '' && $filters[$key] !== 'all') {
                if (! in_array($key, ['municipality', 'year'], true) || ctype_digit($filters[$key])) {
                    $q->where($column, $filters[$key]);
                }
            }
        }

        return $this->render('MaintenanceRecords/Index', $request, [
            'records' => $q->orderBy('m.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->recordData($r, $actor)),
            'projects' => $this->projects($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'municipalities' => $this->municipalities($actor)->map(fn (\stdClass $l): array => ['value' => (string) $l->id, 'label' => $l->municipality_name]),
            'years' => $this->records($actor)->reorder()->distinct()->orderByDesc('m.maintenance_year')->pluck('m.maintenance_year'),
            'filters' => $filters, 'canCreate' => $this->writable($actor), 'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public function recordCreate(Request $request): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $projects = $this->projects($actor)->orderBy('p.project_title')->get();
        $choices = [];
        foreach ($projects->pluck('lgu_id')->unique() as $lgu) {
            $choices[(int) $lgu] = $this->eligibility->choices($actor, (int) $lgu)->get()->all();
        }
        $byProject = [];
        foreach ($projects as $p) {
            $byProject[(int) $p->id] = $choices[(int) $p->lgu_id];
        }

        return $this->render('MaintenanceProjects/Records/Create', $request, [
            'projects' => $projects->map(fn (\stdClass $p): array => $this->projectData($p, $actor)), 'engineers' => [],
            'managerChoicesByProject' => $byProject,
            'records' => $this->records($actor)->get()->map(fn (\stdClass $r): array => $this->recordData($r, $actor)),
            'canWrite' => true, 'cancelUrl' => self::BASE.'/maintenance-records',
        ]);
    }

    /** @param Actor $actor */
    private function updateQuery(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.monthly_updates as u')
            ->join('jairoads_next.maintenance_records as m', 'm.id', '=', 'u.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'u.created_by'), $actor)
            ->select(['u.*', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.managing_engineer_id', 'p.project_title', 'a.username as creator_name'])
            ->selectSub(DB::table('jairoads_next.media as c')->selectRaw('count(*)')->whereColumn('c.monthly_update_id', 'u.id'), 'media_count')
            ->selectSub(DB::table('jairoads_next.media as c')->selectRaw('count(*)')->whereColumn('c.monthly_update_id', 'u.id')->where('c.file_type', 'like', 'image/%'), 'photo_count')
            ->selectSub(DB::table('jairoads_next.media as c')->selectRaw('count(*)')->whereColumn('c.monthly_update_id', 'u.id')->where('c.file_type', 'like', 'video/%'), 'video_count');
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    private function updateData(\stdClass $u, array $actor): array
    {
        return ['id' => (int) $u->id, 'maintenance_id' => (int) $u->maintenance_id, 'update_month' => $u->update_month,
            'progress_percentage' => (float) $u->progress_percentage, 'summary_of_text_reports' => $u->summary_of_text_reports,
            'created_by' => $u->creator_name, 'created_at' => $u->created_at, 'updated_at' => $u->updated_at,
            'project' => ['id' => (int) $u->project_id, 'project_title' => $u->project_title],
            'record' => ['id' => (int) $u->maintenance_id, 'year' => (int) $u->maintenance_year, 'quarter' => $u->quarter],
            'media_count' => (int) $u->media_count, 'can_edit' => $this->canWriteRecord($u, $actor),
            'photo_count' => (int) $u->photo_count, 'video_count' => (int) $u->video_count, 'other_count' => (int) $u->media_count - (int) $u->photo_count - (int) $u->video_count];
    }

    public function updateIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $filters = ['search' => $request->string('search')->toString(), 'project' => $request->string('project', 'all')->toString(),
            'year' => $request->string('year', 'all')->toString(), 'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->updateQuery($actor)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
        if (ctype_digit($filters['project'])) {
            $q->where('p.id', $filters['project']);
        }
        if (ctype_digit($filters['year'])) {
            $q->where('m.maintenance_year', $filters['year']);
        }

        return $this->render('MonthlyUpdates/Index', $request, [
            'updates' => $q->orderBy('u.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $u): array => $this->updateData($u, $actor)),
            'projects' => $this->projects($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'years' => $this->records($actor)->reorder()->distinct()->orderByDesc('m.maintenance_year')->pluck('m.maintenance_year'),
            'filters' => $filters, 'canWrite' => $this->writable($actor),
        ]);
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    private function parents(array $actor, Request $request, ?int $fixedRecord = null): array
    {
        $records = $this->records($actor)->orderByDesc('m.maintenance_year')->get()
            ->filter(fn (\stdClass $r): bool => $this->canWriteRecord($r, $actor));
        $context = $fixedRecord ?? ($request->integer('maintenance_id') ?: null);
        abort_if($context !== null && ! $records->contains('id', $context), 403);

        return ['projects' => $this->projects($actor)->whereIn('p.id', $records->pluck('project_id'))->orderBy('p.project_title')->get()
            ->map(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'records' => $records->map(fn (\stdClass $r): array => ['id' => (int) $r->id, 'project_id' => (int) $r->project_id, 'year' => (int) $r->maintenance_year, 'quarter' => $r->quarter])->values(),
            'contextRecordId' => $context, 'canWrite' => true];
    }

    public function updateForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $u = $id === null ? null : $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_if($id !== null && $u === null, 404);
        abort_if($u !== null && ! $this->canWriteRecord($u, $actor), 403);

        return $this->render('MonthlyUpdates/Create', $request, $this->parents($actor, $request, $u === null ? null : (int) $u->maintenance_id) + [
            'update' => $u === null ? null : $this->updateData($u, $actor), 'media' => $id === null ? [] : $this->mediaData($id),
            'existingUpdates' => $this->updateQuery($actor)->get(['u.id', 'u.maintenance_id', 'u.update_month']),
            'submitUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function saveUpdate(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        // The canonical upload workflow compensates storage one file at a time.
        // Do not pretend a batch of preview attachments is an atomic report save.
        $request->validate(['attachments' => ['prohibited'], 'removed_media_ids' => ['prohibited']]);
        $this->operations->saveUpdate($request, $this->identities, $id);
        $id ??= (int) DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $request->input('maintenance_id'))
            ->where('update_month', $request->input('update_month'))->value('id');

        return redirect(self::BASE.'/monthly-updates/'.$id)->with('dd_operations_status', 'MonthlyUpdate saved. Media can be uploaded separately below.');
    }

    /** @return array<int,array{id:int,file_name:string,mime_type:string,size:null,available:bool,preview_url:?string}> */
    private function mediaData(int $update): array
    {
        return DB::table('jairoads_next.media')->where('monthly_update_id', $update)->orderBy('id')
            ->get(['id', 'file_name', 'file_type'])->map(fn (\stdClass $m): array => [
                'id' => (int) $m->id, 'file_name' => (string) $m->file_name, 'mime_type' => (string) $m->file_type, 'size' => null,
                'available' => $this->media->configured(), 'preview_url' => $this->media->configured() ? '/dd-phase3/files/media/'.$m->id : null,
            ])->all();
    }

    public function updateShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $u = $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_unless($u !== null, 404);

        return $this->render('MonthlyUpdates/Show', $request, [
            'update' => $this->updateData($u, $actor), 'media' => $this->mediaData($id), 'canWrite' => $this->canWriteRecord($u, $actor),
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

        return redirect(self::BASE.'/monthly-updates/'.$id)->with('dd_operations_status', 'Private media uploaded.');
    }

    /** @param Actor $actor */
    private function documentQuery(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.maintenance_documents as d')
            ->join('jairoads_next.maintenance_records as m', 'm.id', '=', 'd.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'd.uploaded_by'), $actor)
            ->select(['d.id', 'd.maintenance_id', 'd.document_title', 'd.description', 'd.file_name', 'd.uploaded_at', 'd.updated_at',
                'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.managing_engineer_id', 'p.project_title', 'l.municipality_name', 'a.username as uploader_name']);
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    private function documentData(\stdClass $d, array $actor): array
    {
        return ['id' => (int) $d->id, 'maintenance_id' => (int) $d->maintenance_id, 'document_title' => $d->document_title,
            'description' => $d->description, 'file_name' => $d->file_name, 'uploaded_by' => $d->uploader_name,
            'uploaded_at' => $d->uploaded_at, 'updated_at' => $d->updated_at, 'available' => $this->documents->configured(),
            'download_url' => '/dd-phase3/files/document/'.$d->id, 'can_edit' => $this->canWriteRecord($d, $actor),
            'project' => ['id' => (int) $d->project_id, 'project_title' => $d->project_title, 'municipality' => $d->municipality_name],
            'record' => ['id' => (int) $d->maintenance_id, 'project_id' => (int) $d->project_id, 'year' => (int) $d->maintenance_year, 'quarter' => $d->quarter]];
    }

    public function documentIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $filters = ['search' => $request->string('search')->toString(), 'project' => $request->string('project', 'all')->toString(),
            'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->documentQuery($actor)->when($filters['search'] !== '', fn (Builder $q) => $q->where('d.document_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
        if (ctype_digit($filters['project'])) {
            $q->where('p.id', $filters['project']);
        }

        return $this->render('MaintenanceDocuments/Index', $request, [
            'documents' => $q->orderBy('d.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $d): array => $this->documentData($d, $actor)),
            'projects' => $this->projects($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'filters' => $filters, 'canWrite' => $this->writable($actor),
        ]);
    }

    public function documentShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $d = $this->documentQuery($actor)->where('d.id', $id)->first();
        abort_unless($d !== null, 404);

        return $this->render('MaintenanceDocuments/Show', $request, ['document' => $this->documentData($d, $actor), 'canWrite' => $this->canWriteRecord($d, $actor)]);
    }

    public function documentForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $d = $id === null ? null : $this->documentQuery($actor)->where('d.id', $id)->first();
        abort_if($id !== null && $d === null, 404);
        abort_if($d !== null && ! $this->canWriteRecord($d, $actor), 403);

        return $this->render('MaintenanceDocuments/Form', $request, $this->parents($actor, $request, $d === null ? null : (int) $d->maintenance_id) + [
            'document' => $d === null ? null : $this->documentData($d, $actor),
            'submitUrl' => self::BASE.'/maintenance-documents'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/maintenance-documents'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function saveDocument(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        if ($id === null) {
            $upload = Request::createFrom($request);
            $upload->files->set('file', $request->file('attachment'));
            $this->write(fn () => $this->operations->uploadDocument($upload, $this->identities, $this->documents), ['file' => 'attachment']);
        } else {
            $request->validate(['attachment' => ['prohibited']]);
            $this->operations->updateDocument($request, $this->identities, $id);
        }

        return redirect(self::BASE.'/maintenance-documents'.($id === null ? '' : '/'.$id))->with('dd_operations_status', 'MaintenanceDocument saved.');
    }

    public function reassign(Request $request, int $project, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(DdRoleAccess::managesBusinessData($actor['role']), 403);
        abort_unless($this->records($actor)->where('m.project_id', $project)->where('m.id', $id)->exists(), 404);
        $this->operations->reassignRecord($request, $this->identities, $id);

        return redirect(self::BASE.'/maintenance-projects/'.$project.'/records/'.$id)->with('dd_operations_status', 'ManagingEngineer reassigned.');
    }

    /** @param \Closure():mixed $operation
     * @param  array<string,string>  $aliases
     */
    private function write(\Closure $operation, array $aliases = []): void
    {
        try {
            $operation();
        } catch (ValidationException $e) {
            $errors = [];
            foreach ($e->errors() as $key => $messages) {
                $errors[$aliases[$key] ?? $key] = $messages;
            }
            throw ValidationException::withMessages($errors);
        }
    }
}
