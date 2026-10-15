<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkDeleteMaintenanceProjectsRequest;
use App\Http\Requests\StoreMaintenanceProjectRequest;
use App\Http\Requests\UpdateMaintenanceProjectRequest;
use App\Models\Lgu;
use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use App\Services\MaintenanceProjects\ProjectMutations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceProjectController extends Controller
{
    public function __construct(private ProjectMutations $mutations) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'municipality' => ['nullable', 'integer', 'min:1'],
            'sort' => ['nullable', 'in:newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        unset($filters['page']);
        $filters = array_replace(['search' => '', 'municipality' => '', 'sort' => 'newest'], $filters);
        $filters['search'] = trim((string) $filters['search']);
        $filters['municipality'] ??= '';
        $filters['sort'] ??= 'newest';
        $integration = $this->integration('viewAny');
        if (! $integration['ready']) {
            return Inertia::render('MaintenanceProjects/Index', [
                'projects' => ['data' => [], 'total' => 0, 'from' => null, 'to' => null, 'current_page' => 1, 'last_page' => 1, 'links' => []],
                'municipalities' => [], 'filters' => $filters,
                'integration' => $integration, 'canCreate' => false, 'canBulkDelete' => false,
            ]);
        }
        $query = $this->projects();
        if ($filters['search'] !== '') {
            $query->whereLike('project_title', '%'.$filters['search'].'%');
        }
        if ($filters['municipality'] !== '' && $filters['municipality'] !== null) {
            $query->whereHas('roadCoverage', fn (Builder $coverage) => $coverage->where('lgus_id', $filters['municipality']));
        }
        $direction = $filters['sort'] === 'oldest' ? 'asc' : 'desc';
        $lastPage = max(1, (int) ceil((clone $query)->count() / 10));

        return Inertia::render('MaintenanceProjects/Index', [
            'projects' => $query->orderBy('created_at', $direction)->orderBy('id', $direction)
                ->paginate(10, ['*'], 'page', min($request->integer('page', 1), $lastPage))
                ->withQueryString()->through(fn ($project) => $this->projectData($project)),
            'municipalities' => Lgu::query()->orderBy('municipality_name')->get(['id', 'municipality_name']),
            'filters' => $filters, 'integration' => $integration,
            'canCreate' => Gate::allows('create', MaintenanceProject::class),
            'canBulkDelete' => Gate::allows('deleteAny', MaintenanceProject::class),
        ]);
    }

    public function create(Request $request): Response
    {
        $integration = $this->integration('create');

        return Inertia::render('MaintenanceProjects/Create', [
            'coverages' => $integration['ready'] ? $this->coverageChoices() : [],
            'integration' => $integration,
        ]);
    }

    public function store(StoreMaintenanceProjectRequest $request): RedirectResponse
    {
        $project = $this->mutations->create($request->user(), $request->validated());

        return to_route('maintenance-projects.show', $project);
    }

    public function show(MaintenanceProject $maintenanceProject): Response
    {
        Gate::authorize('view', $maintenanceProject);
        $project = $this->projects()->findOrFail($maintenanceProject->id);

        return Inertia::render('MaintenanceProjects/Show', [
            'project' => $this->projectData($project),
            'records' => $project->maintenanceRecords()->orderByDesc('maintenance_year')->orderBy('quarter')
                ->get(['id', 'maintenance_year', 'quarter', 'status'])
                ->map(fn ($record) => ['id' => $record->id, 'year' => $record->maintenance_year, 'quarter' => $record->quarter, 'status' => $record->status]),
        ]);
    }

    public function edit(MaintenanceProject $maintenanceProject): Response
    {
        Gate::authorize('update', $maintenanceProject);
        $project = $this->projects()->findOrFail($maintenanceProject->id);

        return Inertia::render('MaintenanceProjects/Edit', [
            'project' => $this->projectData($project),
            'coverages' => $this->coverageChoices($project),
            'integration' => $this->integration('viewAny'),
        ]);
    }

    public function update(UpdateMaintenanceProjectRequest $request, MaintenanceProject $maintenanceProject): RedirectResponse
    {
        $project = $this->mutations->update($request->user(), $maintenanceProject->id, $request->validated());

        return to_route('maintenance-projects.show', $project);
    }

    public function destroy(Request $request, MaintenanceProject $maintenanceProject): RedirectResponse
    {
        Gate::authorize('delete', $maintenanceProject);
        $this->mutations->delete($request->user(), [$maintenanceProject->id]);

        return to_route('maintenance-projects.index');
    }

    public function bulkDestroy(BulkDeleteMaintenanceProjectsRequest $request): RedirectResponse
    {
        $this->mutations->delete($request->user(), $request->validated('project_ids'));

        return to_route('maintenance-projects.index');
    }

    private function projects(): Builder
    {
        return MaintenanceProject::query()->withCount('maintenanceRecords')->with([
            'roadCoverage:id,lgus_id,road_name', 'roadCoverage.lgu:id,municipality_name', 'createdBy:id,username',
        ]);
    }

    private function coverageChoices(?MaintenanceProject $current = null)
    {
        return RoadCoverage::query()->select(['id', 'road_name', 'lgus_id', 'kilometers'])
            ->with(['lgu:id,municipality_name', 'maintenanceProject:id,road_coverage_id'])->orderBy('road_name')->get()
            ->filter(fn ($coverage) => $coverage->id === $current?->road_coverage_id
                || Gate::allows('assignCoverage', [MaintenanceProject::class, $coverage]))
            ->map(fn ($coverage) => [
                'id' => $coverage->id, 'road_name' => $coverage->road_name,
                'municipality' => $coverage->lgu?->municipality_name, 'kilometers' => $coverage->kilometers,
                'assigned' => $coverage->maintenanceProject !== null && $coverage->maintenanceProject->id !== $current?->id,
            ])->values();
    }

    /** Unlinked users never query protected tables or receive fixture data. */
    private function integration(string $ability): array
    {
        if (! Gate::allows($ability, MaintenanceProject::class)) {
            return ['ready' => false, 'message' => 'Project access requires a verified account link. Project records and saving are unavailable for this account.'];
        }
        if (! Schema::hasTable('road_coverages') || ! Schema::hasTable('maintenance_records')
            || ! Schema::hasColumn('maintenance_projects', 'road_coverage_id')) {
            return ['ready' => false, 'message' => 'Project data is unavailable until the database structure has been verified and approved changes applied.'];
        }

        return ['ready' => true, 'message' => null];
    }

    private function projectData(MaintenanceProject $project): array
    {
        return [
            'id' => $project->id, 'project_title' => $project->project_title, 'description' => $project->description,
            'road_coverage_id' => $project->road_coverage_id, 'road_name' => $project->roadCoverage?->road_name,
            'municipality' => $project->roadCoverage?->lgu?->municipality_name,
            'created_by' => $project->createdBy?->username,
            'created_at' => $project->created_at?->toIso8601String(), 'updated_at' => $project->updated_at?->toIso8601String(),
            'maintenance_records_count' => (int) $project->maintenance_records_count,
            'can_edit' => Gate::allows('update', $project), 'can_delete' => Gate::allows('delete', $project),
        ];
    }
}
