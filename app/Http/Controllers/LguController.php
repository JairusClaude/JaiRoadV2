<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLguRequest;
use App\Http\Requests\UpdateLguRequest;
use App\Models\Lgu;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class LguController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'municipality_name',
            'province',
            'region',
            'contact_no',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = Lgu::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('municipality_name', 'like', $like)
                    ->orWhere('province', 'like', $like)
                    ->orWhere('region', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

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

        return to_route('lgus.index')
            ->with('message', 'Successfully created a new LGU');
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

        return to_route('lgus.index', $request->query())
            ->with('message', 'Successfully updated an LGU');
    }

    public function destroy(Lgu $lgu): RedirectResponse
    {
        $lgu->delete();

        return to_route('lgus.index')
            ->with('message', 'Successfully deleted an LGU');
    }
}
