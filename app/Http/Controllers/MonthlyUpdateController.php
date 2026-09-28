<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMonthlyUpdateRequest;
use App\Http\Requests\UpdateMonthlyUpdateRequest;
use App\Models\MaintenanceProject;
use App\Models\MonthlyUpdate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class MonthlyUpdateController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'update_month',
            'progress_percentage',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = MonthlyUpdate::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('update_month', 'like', $like)
                    ->orWhere('summary_of_text_reports', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('MonthlyUpdates/Index', [
            'model' => $model,
            'maintenanceProjects' => MaintenanceProject::query()
                ->orderBy('project_title')
                ->pluck('id', 'project_title'),
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

        return to_route('monthly-updates.index')
            ->with('message', 'Successfully created a monthly update');
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
        $monthlyUpdate->update($request->validated());

        return to_route('monthly-updates.index', $request->query())
            ->with(
                'message',
                'Successfully updated a monthly update'
            );
    }

    public function destroy(MonthlyUpdate $monthlyUpdate): RedirectResponse
    {
        $monthlyUpdate->delete();

        return to_route('monthly-updates.index')
            ->with('message', 'Successfully deleted a monthly update');
    }
}
