<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenanceProjectRequest;
use App\Http\Requests\UpdateMaintenanceProjectRequest;
use App\Models\Engineer;
use App\Models\Lgu;
use App\Models\MaintenanceProject;
use Inertia\Inertia;

class MaintenanceProjectController extends Controller
{
    public function index()
    {
        $model = MaintenanceProject::query()
            ->where(
                'project_title',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'status',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('MaintenanceProjects/Index', [
            'model' => $model,
            'lgus' => Lgu::orderBy('municipality_name', 'asc')
                ->pluck('id', 'municipality_name'),
            'engineers' => Engineer::orderBy('last_name', 'asc')
                ->get(),
            'queryParams' => request()->query(),
        ]);
    }

    public function create()
    {
        //
    }

    public function store(StoreMaintenanceProjectRequest $request)
    {
        MaintenanceProject::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a new maintenance project'
        );

        return redirect(
            route('maintenance-projects.index')
        );
    }

    public function show(
        MaintenanceProject $maintenanceProject
    ) {
        //
    }

    public function edit(
        MaintenanceProject $maintenanceProject
    ) {
        //
    }

    public function update(
        UpdateMaintenanceProjectRequest $request,
        MaintenanceProject $maintenanceProject
    ) {
        $maintenanceProject->update(
            $request->validated()
        );

        session()->flash(
            'message',
            'Successfully updated a maintenance project'
        );

        return redirect(
            route(
                'maintenance-projects.index',
                $request->query()
            )
        );
    }

    public function destroy(
        MaintenanceProject $maintenanceProject
    ) {
        $maintenanceProject->delete();

        session()->flash(
            'message',
            'Successfully deleted a maintenance project'
        );

        return redirect(
            route('maintenance-projects.index')
        );
    }
}