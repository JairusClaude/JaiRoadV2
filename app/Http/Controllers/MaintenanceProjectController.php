<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenanceProjectRequest;
use App\Http\Requests\UpdateMaintenanceProjectRequest;
use App\Models\Engineer;
use App\Models\Lgu;
use App\Models\MaintenanceProject;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceProjectController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'project_title',
            'status',
            'start_date',
            'end_date',
            'gravelled_road_in_km',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = MaintenanceProject::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('project_title', 'like', $like)
                    ->orWhere('status', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('MaintenanceProjects/Index', [
            'model' => $model,
            'lgus' => Lgu::query()
                ->orderBy('municipality_name')
                ->pluck('id', 'municipality_name'),
            'engineers' => Engineer::query()
                ->orderBy('last_name')
                ->get(),
            'queryParams' => request()->query(),
        ]);
    }

    public function create(): void
    {
        //
    }

    public function store(
        StoreMaintenanceProjectRequest $request
    ): RedirectResponse {
        MaintenanceProject::create($request->validated());

        return to_route('maintenance-projects.index')
            ->with(
                'message',
                'Successfully created a new maintenance project'
            );
    }

    public function show(
        MaintenanceProject $maintenanceProject
    ): void {
        //
    }

    public function edit(
        MaintenanceProject $maintenanceProject
    ): void {
        //
    }

    public function update(
        UpdateMaintenanceProjectRequest $request,
        MaintenanceProject $maintenanceProject
    ): RedirectResponse {
        $maintenanceProject->update($request->validated());

        return to_route(
            'maintenance-projects.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated a maintenance project'
        );
    }

    public function destroy(
        MaintenanceProject $maintenanceProject
    ): RedirectResponse {
        $maintenanceProject->delete();

        return to_route('maintenance-projects.index')
            ->with(
                'message',
                'Successfully deleted a maintenance project'
            );
    }
}
