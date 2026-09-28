<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEngineerRequest;
use App\Http\Requests\UpdateEngineerRequest;
use App\Models\Engineer;
use App\Models\Lgu;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class EngineerController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'first_name',
            'middle_name',
            'last_name',
            'email',
            'rank',
            'position',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = Engineer::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('first_name', 'like', $like)
                    ->orWhere('middle_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('rank', 'like', $like)
                    ->orWhere('position', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('Engineers/Index', [
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

    public function store(StoreEngineerRequest $request): RedirectResponse
    {
        Engineer::create($request->validated());

        return to_route('engineers.index')
            ->with('message', 'Successfully created a new engineer');
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

        return to_route('engineers.index', $request->query())
            ->with('message', 'Successfully updated an engineer');
    }

    public function destroy(Engineer $engineer): RedirectResponse
    {
        $engineer->delete();

        return to_route('engineers.index')
            ->with('message', 'Successfully deleted an engineer');
    }
}
