<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenanceProjectRequest;
use App\Http\Requests\UpdateMaintenanceProjectRequest;
use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceProjectController extends Controller
{
    /**
     * Display the maintenance project list.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', MaintenanceProject::class);

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'project_title'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'asc')
        );

        $allowedSortFields = [
            'project_title',
            'created_at',
            'updated_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'project_title';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'asc';
        }

        $query = MaintenanceProject::query()
            ->with('roadCoverage');

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%' . $search . '%';

                $query->where('project_title', 'like', $like)
                    ->orWhere('description', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('MaintenanceProjects/Index', [
            'model' => $model,
            'roadCoverages' => RoadCoverage::query()->get(),
            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Display the form for creating a maintenance project.
     */
    public function create(): Response
    {
        Gate::authorize('create', MaintenanceProject::class);

        return Inertia::render('MaintenanceProjects/Create', [
            'roadCoverages' => RoadCoverage::query()->get(),
        ]);
    }

    /**
     * Store a new maintenance project.
     */
    public function store(
        StoreMaintenanceProjectRequest $request
    ): RedirectResponse {
        Gate::authorize('create', MaintenanceProject::class);

        $data = $request->safe()->only([
            'project_title',
            'road_coverage_id',
            'description',
        ]);

        /*
         * Assumption: the authenticated user's ID is the
         * UserAccount.UserID referenced by CreatedBy.
         * Adjust this mapping if your authentication model differs.
         */
        $data['created_by'] = $request->user()->getAuthIdentifier();

        DB::transaction(function () use ($data): void {
            MaintenanceProject::create($data);
        });

        return to_route('maintenance-projects.index')
            ->with(
                'message',
                'Successfully created a maintenance project.'
            );
    }

    /**
     * Display a specific maintenance project.
     */
    public function show(
        MaintenanceProject $maintenanceProject
    ): Response {
        Gate::authorize('view', $maintenanceProject);

        $maintenanceProject->load('roadCoverage');

        return Inertia::render('MaintenanceProjects/Show', [
            'maintenanceProject' => $maintenanceProject,
        ]);
    }

    /**
     * Display the form for editing a maintenance project.
     */
    public function edit(
        MaintenanceProject $maintenanceProject
    ): Response {
        Gate::authorize('update', $maintenanceProject);

        return Inertia::render('MaintenanceProjects/Edit', [
            'maintenanceProject' => $maintenanceProject
                ->load('roadCoverage'),
            'roadCoverages' => RoadCoverage::query()->get(),
        ]);
    }

    /**
     * Update a maintenance project.
     */
    public function update(
        UpdateMaintenanceProjectRequest $request,
        MaintenanceProject $maintenanceProject
    ): RedirectResponse {
        Gate::authorize('update', $maintenanceProject);

        $data = $request->safe()->only([
            'project_title',
            'road_coverage_id',
            'description',
        ]);

        DB::transaction(function () use (
            $maintenanceProject,
            $data
        ): void {
            $maintenanceProject->update($data);
        });

        return to_route(
            'maintenance-projects.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated the maintenance project.'
        );
    }

    /**
     * Delete a project only when no maintenance records depend on it.
     */
    public function destroy(
        MaintenanceProject $maintenanceProject
    ): RedirectResponse {
        Gate::authorize('delete', $maintenanceProject);

        if ($maintenanceProject->maintenanceRecords()->exists()) {
            return to_route('maintenance-projects.index')
                ->with(
                    'error',
                    'This project cannot be deleted while MaintenanceRecord '
                    . 'entries reference it. Handle those records explicitly '
                    . 'before attempting deletion.'
                );
        }

        DB::transaction(function () use (
            $maintenanceProject
        ): void {
            $maintenanceProject->delete();
        });

        return to_route('maintenance-projects.index')
            ->with(
                'message',
                'Successfully deleted the maintenance project.'
            );
    }
}
