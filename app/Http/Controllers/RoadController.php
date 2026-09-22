<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoadRequest;
use App\Http\Requests\UpdateRoadRequest;
use App\Models\Lgu;
use App\Models\Road;
use Inertia\Inertia;

class RoadController extends Controller
{
    public function index()
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

    public function create()
    {
        //
    }

    public function store(StoreRoadRequest $request)
    {
        Road::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a new road section'
        );

        return redirect(route('roads.index'));
    }

    public function show(Road $road)
    {
        //
    }

    public function edit(Road $road)
    {
        //
    }

    public function update(
        UpdateRoadRequest $request,
        Road $road
    ) {
        $road->update($request->validated());

        session()->flash(
            'message',
            'Successfully updated a road section'
        );

        return redirect(
            route('roads.index', $request->query())
        );
    }

    public function destroy(Road $road)
    {
        $road->delete();

        session()->flash(
            'message',
            'Successfully deleted a road section'
        );

        return redirect(route('roads.index'));
    }
}