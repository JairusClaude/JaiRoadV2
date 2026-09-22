<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLguRequest;
use App\Http\Requests\UpdateLguRequest;
use App\Models\Lgu;
use Inertia\Inertia;

class LguController extends Controller
{
    public function index()
    {
        $model = Lgu::query()
            ->where(
                'municipality_name',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'province',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'region',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('LGUs/Index', [
            'model' => $model,
            'queryParams' => request()->query(),
        ]);
    }

    public function create()
    {
        //
    }

    public function store(StoreLguRequest $request)
    {
        Lgu::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a new LGU'
        );

        return redirect(route('lgus.index'));
    }

    public function show(Lgu $lgu)
    {
        //
    }

    public function edit(Lgu $lgu)
    {
        //
    }

    public function update(
        UpdateLguRequest $request,
        Lgu $lgu
    ) {
        $lgu->update($request->validated());

        session()->flash(
            'message',
            'Successfully updated an LGU'
        );

        return redirect(
            route('lgus.index', $request->query())
        );
    }

    public function destroy(Lgu $lgu)
    {
        $lgu->delete();

        session()->flash(
            'message',
            'Successfully deleted an LGU'
        );

        return redirect(route('lgus.index'));
    }
}