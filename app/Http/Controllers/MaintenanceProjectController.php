<?php

namespace App\Http\Controllers;

use App\Http\Requests\BulkDeleteMaintenanceProjectsRequest;
use App\Http\Requests\StoreMaintenanceProjectRequest;
use App\Http\Requests\UpdateMaintenanceProjectRequest;
use App\Models\Lgu;
use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use App\Services\MaintenanceProjects\ProjectMutations;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceProjectController extends Controller
{
    public function __construct(
        private ProjectMutations $mutations
    ) {}

    /**
     * Display the maintenance project list with search and filters.
     */
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'municipality' => ['nullable', 'integer', 'min:1'],
            'sort' => ['nullable', 'in:newest,oldest'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        unset($filters['page']);

        $filters = array_replace([
            'search' => '',
            'municipality' => '',
            'sort' => 'newest',
        ], $filters);

        $filters['search'] = trim((string) $filters['search']);
        $filters['municipality'] ??= '';
        $filters['sort'] ??= 'newest';

        $integration = $this->integration('viewAny');

        if (! $integration['ready']) {
            return Inertia::render('MaintenanceProjects/Index', [
                'projects' => [
                    'data' => [],
                    'total' => 0,
                    'from' => null,
                    'to' => null,
                    'current_page' => 1,
                    'last_page' => 1,
                    'links' => [],
                ],
                'municipalities' => [],
                'filters' => $filters,
                'integration' => $integration,
                'canCreate' => false,
                'canBulkDelete' => false,
            ]);
        }

        $query = $this->projects();

        if ($filters['search'] !== '') {
            $query->whereLike(
                'project_title',
                '%'.$filters['search'].'%'
            );
        }

        if ($filters['municipality'] !== '') {
            $query->whereHas(
                'roadCoverage',
                fn (Builder $coverage) => $coverage->where(
                    'lgu_id',
                    $filters['municipality']
                )
            );
        }

        $direction = $filters['sort'] === 'oldest' ? 'asc' : 'desc';

        $lastPage = max(
            1,
            (int) ceil((clone $query)->count() / 10)
        );

        $page = min(
            $request->integer('page', 1),
            $lastPage
        );

        return Inertia::render('MaintenanceProjects/Index', [
            'projects' => $query
                ->orderBy('created_at', $direction)
                ->orderBy('id', $direction)
                ->paginate(10, ['*'], 'page', $page)
                ->withQueryString()
                ->through(
                    fn ($project) => $this->projectData($project)
                ),

            'municipalities' => Lgu::query()
                ->orderBy('municipality_name')
                ->get(['id', 'municipality_name']),

            'filters' => $filters,
            'integration' => $integration,
            'canCreate' => Gate::allows(
                'create',
                MaintenanceProject::class
            ),
            'canBulkDelete' => Gate::allows(
                'deleteAny',
                MaintenanceProject::class
            ),
        ]);
    }

    /**
     * Display the create form.
     */
    public function create(): Response
    {
        $integration = $this->integration('create');

        return Inertia::render('MaintenanceProjects/Create', [
            'coverages' => $integration['ready']
                ? $this->coverageChoices()
                : [],
            'integration' => $integration,
        ]);
    }

    /**
     * Store a maintenance project through the mutation service.
     */
    public function store(
        StoreMaintenanceProjectRequest $request
    ): RedirectResponse {
        $project = $this->mutations->create(
            $request->user(),
            $request->validated()
        );

        return to_route('maintenance-projects.show', $project);
    }

    /**
     * Display a maintenance project and its maintenance records.
     */
    public function show(
        MaintenanceProject $maintenanceProject
    ): Response {
        Gate::authorize('view', $maintenanceProject);

        $project = $this->projects()
            ->whereKey($maintenanceProject->getKey())
            ->firstOrFail();

        // Read only the viewed project's linked coverage. No broad GeoJSON query.
        $coverage = $project->roadCoverage()->first([
            'id', 'road_name', 'lgu_id', 'kilometers', 'geojson',
        ]);

        return Inertia::render('MaintenanceProjects/Show', [
            'project' => $this->projectData($project),
            'canCreateRecord' => Gate::allows('create', \App\Models\MaintenanceRecord::class),
            'coveragePreview' => $coverage ? [
                'id' => $coverage->id,
                'road_name' => $coverage->road_name,
                'municipality' => $project->roadCoverage?->lgu?->municipality_name,
                'kilometers' => (string) $coverage->kilometers,
                'assigned' => true,
                'geojson' => $coverage->geojson,
            ] : null,

            'records' => $project->maintenanceRecords()
                ->orderByDesc('maintenance_year')
                ->orderBy('quarter')
                ->get([
                    'id',
                    'maintenance_year',
                    'quarter',
                    'status',
                ])
                ->map(fn ($record) => [
                    'id' => $record->id,
                    'year' => $record->maintenance_year,
                    'quarter' => $record->quarter,
                    'status' => $record->status,
                ]),
        ]);
    }

    /**
     * Display the edit form.
     */
    public function edit(
        MaintenanceProject $maintenanceProject
    ): Response {
        Gate::authorize('update', $maintenanceProject);

        $project = $this->projects()
            ->whereKey($maintenanceProject->getKey())
            ->firstOrFail();

        return Inertia::render('MaintenanceProjects/Edit', [
            'project' => $this->projectData($project),
            'coverages' => $this->coverageChoices($project),
            'integration' => $this->integration('viewAny'),
        ]);
    }

    /**
     * Update a maintenance project through the mutation service.
     */
    public function update(
        UpdateMaintenanceProjectRequest $request,
        MaintenanceProject $maintenanceProject
    ): RedirectResponse {
        $project = $this->mutations->update(
            $request->user(),
            $maintenanceProject->getKey(),
            $request->validated()
        );

        return to_route('maintenance-projects.show', $project);
    }

    /**
     * Delete one project through the mutation service.
     */
    public function destroy(
        Request $request,
        MaintenanceProject $maintenanceProject
    ): RedirectResponse {
        Gate::authorize('delete', $maintenanceProject);

        $this->mutations->delete(
            $request->user(),
            [$maintenanceProject->getKey()]
        );

        return to_route('maintenance-projects.index');
    }

    /**
     * Delete multiple projects through the mutation service.
     */
    public function bulkDestroy(
        BulkDeleteMaintenanceProjectsRequest $request
    ): RedirectResponse {
        $this->mutations->delete(
            $request->user(),
            $request->validated('project_ids')
        );

        return to_route('maintenance-projects.index');
    }

    /**
     * Build the query used for project pages.
     */
    /** @return Builder<MaintenanceProject> */
    private function projects(): Builder
    {
        $query = MaintenanceProject::query();
        $user = Auth::user();
        if ($user instanceof \App\Models\User) {
            $accounts = app(VerifiedProjectAccount::class);
            if ($accounts->role($user) === 'engineer') {
                $account = $accounts->resolve($user);
                if (! $account?->engineers_id) {
                    $query->whereRaw('1 = 0');
                } else {
                    $query->whereHas('roadCoverage', fn (Builder $coverage) => $coverage
                        ->whereIn('lgu_id', DB::table('engineer_lgus')
                            ->select('lgus_id')
                            ->where('engineers_id', $account->engineers_id)
                            ->where('is_active', true)));
                }
            }
        }
        return $query->withCount('maintenanceRecords')
            ->with([
                'roadCoverage:id,lgu_id,road_name',
                'roadCoverage.lgu:id,municipality_name',
                'createdBy:id,username',
            ]);
    }

    /**
     * List RoadCoverage choices that the current user is allowed to assign.
     */
    /** @return \Illuminate\Support\Collection<int, array{id: mixed, road_name: mixed, municipality: mixed, kilometers: mixed, assigned: bool, geojson: mixed}> */
    private function coverageChoices(
        ?MaintenanceProject $current = null
    ): \Illuminate\Support\Collection {
        return RoadCoverage::query()
            ->select([
                'id',
                'road_name',
                'lgu_id',
                'kilometers',
                'geojson',
            ])
            ->with([
                'lgu:id,municipality_name',
                'maintenanceProject:id,road_coverage_id',
            ])
            ->orderBy('road_name')
            ->get()
            ->filter(
                fn ($coverage) => $coverage->id === $current?->road_coverage_id
                    || Gate::allows(
                        'assignCoverage',
                        [MaintenanceProject::class, $coverage]
                    )
            )
            ->map(fn ($coverage) => [
                'id' => $coverage->id,
                'road_name' => $coverage->road_name,
                'municipality' => $coverage->lgu?->municipality_name,
                'kilometers' => $coverage->kilometers,
                'geojson' => $coverage->geojson,
                'assigned' => $coverage->maintenanceProject !== null
                    && $coverage->maintenanceProject->id
                        !== $current?->getKey(),
            ])
            ->values();
    }

    /**
     * Verify permissions and required database structure.
     */
    /** @return array{ready: bool, message: string|null} */
    private function integration(string $ability): array
    {
        if (! Gate::allows($ability, MaintenanceProject::class)) {
            return [
                'ready' => false,
                'message' => 'Project access requires a verified account link. '
                    .'Project records and saving are unavailable for this account.',
            ];
        }

        if (
            ! Schema::hasTable('maintenance_projects')
            || ! Schema::hasTable('road_coverages')
            || ! Schema::hasTable('maintenance_records')
            || ! Schema::hasColumn(
                'maintenance_projects',
                'road_coverage_id'
            )
            || ! Schema::hasColumn('road_coverages', 'lgu_id')
        ) {
            return [
                'ready' => false,
                'message' => 'Project data is unavailable until the database '
                    .'structure has been verified and approved changes applied.',
            ];
        }

        return [
            'ready' => true,
            'message' => null,
        ];
    }

    /**
     * Transform a project into the frontend's expected structure.
     *
     * @return array<string, mixed>
     */
    private function projectData(
        MaintenanceProject $project
    ): array {
        return [
            'id' => $project->getKey(),
            'project_title' => $project->project_title,
            'description' => $project->description,
            'road_coverage_id' => $project->road_coverage_id,
            'road_name' => $project->roadCoverage?->road_name,
            'municipality' => $project->roadCoverage
                ?->lgu?->municipality_name,
            'created_by' => $project->createdBy?->username,
            'created_at' => $project->created_at?->toIso8601String(),
            'updated_at' => $project->updated_at?->toIso8601String(),
            'maintenance_records_count' => (int) $project->maintenance_records_count,
            'can_edit' => Gate::allows('update', $project),
            'can_delete' => Gate::allows('delete', $project),
        ];
    }
}
