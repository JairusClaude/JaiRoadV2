<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMonthlyUpdateRequest;
use App\Http\Requests\UpdateMonthlyUpdateRequest;
use App\Models\MaintenanceProject;
use App\Models\MonthlyUpdate;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class MonthlyUpdateController extends Controller
{
    public function index(): Response
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
            'maintenanceProjects' => MaintenanceProject::orderBy(
                'project_title',
                'asc'
            )->pluck('id', 'project_title'),
            'queryParams' => request()->query(),
        ]);
    }

    public function create(): void
    {
        //
    }

    public function store(
        StoreMonthlyUpdateRequest $request
    ): RedirectResponse {
        MonthlyUpdate::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a monthly update'
        );

        return redirect(
            route('monthly-updates.index')
        );
    }

    public function show(MonthlyUpdate $monthlyUpdate): void
    {
        //
    }

    public function edit(MonthlyUpdate $monthlyUpdate): void
    {
        //
    }

    public function update(
        UpdateMonthlyUpdateRequest $request,
        MonthlyUpdate $monthlyUpdate
    ): RedirectResponse {
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

    public function destroy(MonthlyUpdate $monthlyUpdate): RedirectResponse
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
