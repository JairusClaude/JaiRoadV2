<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoadRequest;
use App\Http\Requests\UpdateRoadRequest;
use App\Models\Lgu;
use App\Models\Road;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RoadController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'road_name',
            'kilometers',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = Road::query();

        if ($search !== '') {
            $query->where('road_name', 'like', '%'.$search.'%');
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('Roads/Index', [
            'model' => $model,
            'lgus' => Lgu::query()
                ->orderBy('municipality_name')
                ->pluck('id', 'municipality_name'),
            'queryParams' => request()->query(),
        ]);
    }

    public function create(): void
    {
        //
    }

    public function store(StoreRoadRequest $request): RedirectResponse
    {
        Road::create($request->validated());

        return to_route('roads.index')
            ->with('message', 'Successfully created a new road section');
    }

    public function show(Road $road): void
    {
        //
    }

    public function edit(Road $road): void
    {
        //
    }

    public function update(
        UpdateRoadRequest $request,
        Road $road
    ): RedirectResponse {
        $road->update($request->validated());

        return to_route('roads.index', $request->query())
            ->with('message', 'Successfully updated a road section');
    }

    public function destroy(Road $road): RedirectResponse
    {
        $road->delete();

        return to_route('roads.index')
            ->with('message', 'Successfully deleted a road section');
    }
}
