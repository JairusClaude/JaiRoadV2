<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUpdatesMediaRequest;
use App\Http\Requests\UpdateUpdatesMediaRequest;
use App\Models\MonthlyUpdate;
use App\Models\UpdatesMedia;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class UpdatesMediaController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'file_name',
            'file_type',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = UpdatesMedia::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('file_name', 'like', $like)
                    ->orWhere('file_type', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('UpdatesMedia/Index', [
            'model' => $model,
            'monthlyUpdates' => MonthlyUpdate::query()
                ->orderBy('update_month')
                ->pluck('id', 'update_month'),
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
        UpdatesMedia::create($request->validated());

        return to_route('updates-media.index')
            ->with('message', 'Successfully uploaded update media');
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
        $updatesMedia->update($request->validated());

        return to_route(
            'updates-media.index',
            $request->query()
        )->with('message', 'Successfully updated update media');
    }

    public function destroy(
        UpdatesMedia $updatesMedia
    ): RedirectResponse {
        $updatesMedia->delete();

        return to_route('updates-media.index')
            ->with('message', 'Successfully deleted update media');
    }
}
