<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMonthlyUpdateRequest;
use App\Http\Requests\UpdateMonthlyUpdateRequest;
use App\Models\MaintenanceProject;
use App\Models\MonthlyUpdate;
use Inertia\Inertia;

class MonthlyUpdateController extends Controller
{
    public function index()
    {
        $model = MonthlyUpdate::query()
            ->where(
                'update_month',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'summary_of_text_reports',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('MonthlyUpdates/Index', [
            'model' => $model,
            'maintenanceProjects' =>
                MaintenanceProject::orderBy(
                    'project_title',
                    'asc'
                )->pluck('id', 'project_title'),
            'queryParams' => request()->query(),
        ]);
    }

    public function create()
    {
        //
    }

    public function store(StoreMonthlyUpdateRequest $request)
    {
        MonthlyUpdate::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a monthly update'
        );

        return redirect(
            route('monthly-updates.index')
        );
    }

    public function show(MonthlyUpdate $monthlyUpdate)
    {
        //
    }

    public function edit(MonthlyUpdate $monthlyUpdate)
    {
        //
    }

    public function update(
        UpdateMonthlyUpdateRequest $request,
        MonthlyUpdate $monthlyUpdate
    ) {
        $monthlyUpdate->update(
            $request->validated()
        );

        session()->flash(
            'message',
            'Successfully updated a monthly update'
        );

        return redirect(
            route(
                'monthly-updates.index',
                $request->query()
            )
        );
    }

    public function destroy(MonthlyUpdate $monthlyUpdate)
    {
        $monthlyUpdate->delete();

        session()->flash(
            'message',
            'Successfully deleted a monthly update'
        );

        return redirect(
            route('monthly-updates.index')
        );
    }
}