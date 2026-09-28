<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEngineerRequest;
use App\Http\Requests\UpdateEngineerRequest;
use App\Models\Engineer;
use App\Models\Lgu;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class EngineerController extends Controller
{
    public function index(): Response
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

    public function create(): void
    {
        //
    }

    public function store(StoreEngineerRequest $request): RedirectResponse
    {
        Engineer::create($request->validated());

        session()->flash(
            'message',
            'Successfully created a new engineer'
        );

        return redirect(route('engineers.index'));
    }

    public function show(Engineer $engineer): void
    {
        //
    }

    public function edit(Engineer $engineer): void
    {
        //
    }

    public function update(
        UpdateEngineerRequest $request,
        Engineer $engineer
    ): RedirectResponse {
        $engineer->update($request->validated());

        session()->flash(
            'message',
            'Successfully updated an engineer'
        );

        return redirect(
            route('engineers.index', $request->query())
        );
    }

    public function destroy(Engineer $engineer): RedirectResponse
    {
        $engineer->delete();

        session()->flash(
            'message',
            'Successfully deleted an engineer'
        );

        return redirect(route('engineers.index'));
    }
}
