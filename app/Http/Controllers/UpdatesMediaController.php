<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUpdatesMediaRequest;
use App\Http\Requests\UpdateUpdatesMediaRequest;
use App\Models\MonthlyUpdate;
use App\Models\UpdatesMedia;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class UpdatesMediaController extends Controller
{
    public function index(): Response
    {
        $model = UpdatesMedia::query()
            ->where(
                'file_name',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'file_type',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('UpdatesMedia/Index', [
            'model' => $model,
            'monthlyUpdates' => MonthlyUpdate::orderBy(
                'update_month',
                'asc'
            )->pluck('id', 'update_month'),
            'queryParams' => request()->query(),
        ]);
    }

    public function create(): void
    {
        //
    }

    public function store(
        StoreUpdatesMediaRequest $request
    ): RedirectResponse {
        UpdatesMedia::create(
            $request->validated()
        );

        session()->flash(
            'message',
            'Successfully uploaded update media'
        );

        return redirect(
            route('updates-media.index')
        );
    }

    public function show(UpdatesMedia $updatesMedia): void
    {
        //
    }

    public function edit(UpdatesMedia $updatesMedia): void
    {
        //
    }

    public function update(
        UpdateUpdatesMediaRequest $request,
        UpdatesMedia $updatesMedia
    ): RedirectResponse {
        $updatesMedia->update(
            $request->validated()
        );

        session()->flash(
            'message',
            'Successfully updated update media'
        );

        return redirect(
            route(
                'updates-media.index',
                $request->query()
            )
        );
    }

    public function destroy(
        UpdatesMedia $updatesMedia
    ): RedirectResponse {
        $updatesMedia->delete();

        session()->flash(
            'message',
            'Successfully deleted update media'
        );

        return redirect(
            route('updates-media.index')
        );
    }
}
