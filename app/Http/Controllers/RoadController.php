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
        $model = Road::query()
            ->where('road_name', 'like', '%'.request()->query('search').'%')
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('Roads/Index', [
            'model' => $model,
            'lgus' => Lgu::orderBy('municipality_name', 'asc')
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

        session()->flash(
            'message',
            'Successfully created a new road section'
        );

        return redirect(route('roads.index'));
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

        session()->flash(
            'message',
            'Successfully updated a road section'
        );

        return redirect(
            route('roads.index', $request->query())
        );
    }

    public function destroy(Road $road): RedirectResponse
    {
        $road->delete();

        session()->flash(
            'message',
            'Successfully deleted a road section'
        );

        return redirect(route('roads.index'));
    }
}
