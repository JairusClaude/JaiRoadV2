<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEngineerRequest;
use App\Http\Requests\UpdateEngineerRequest;
use App\Models\Engineer;
use App\Models\Lgu;
use Inertia\Inertia;

class EngineerController extends Controller
{
    public function index()
    {
        $model = Engineer::query()
            ->where(
                'first_name',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'middle_name',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'last_name',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'email',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'rank',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('Engineers/Index', [
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

    public function store(StoreEngineerRequest $request)
    {
        Engineer::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a new engineer'
        );

        return redirect(route('engineers.index'));
    }

    public function show(Engineer $engineer)
    {
        //
    }

    public function edit(Engineer $engineer)
    {
        //
    }

    public function update(
        UpdateEngineerRequest $request,
        Engineer $engineer
    ) {
        $engineer->update($request->validated());

        session()->flash(
            'message',
            'Successfully updated an engineer'
        );

        return redirect(
            route('engineers.index', $request->query())
        );
    }

    public function destroy(Engineer $engineer)
    {
        $engineer->delete();

        session()->flash(
            'message',
            'Successfully deleted an engineer'
        );

        return redirect(route('engineers.index'));
    }
}