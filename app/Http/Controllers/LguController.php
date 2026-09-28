<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLguRequest;
use App\Http\Requests\UpdateLguRequest;
use App\Models\Lgu;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class LguController extends Controller
{
    public function index(): Response
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

    public function create(): void
    {
        //
    }

    public function store(StoreLguRequest $request): RedirectResponse
    {
        Lgu::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a new LGU'
        );

        return redirect(route('lgus.index'));
    }

    public function show(Lgu $lgu): void
    {
        //
    }

    public function edit(Lgu $lgu): void
    {
        //
    }

    public function update(
        UpdateLguRequest $request,
        Lgu $lgu
    ): RedirectResponse {
        $lgu->update($request->validated());

        session()->flash(
            'message',
            'Successfully updated an LGU'
        );

        return redirect(
            route('lgus.index', $request->query())
        );
    }

    public function destroy(Lgu $lgu): RedirectResponse
    {
        $lgu->delete();

        session()->flash(
            'message',
            'Successfully deleted an LGU'
        );

        return redirect(route('lgus.index'));
    }
}
