<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLguRequest;
use App\Http\Requests\UpdateLguRequest;
use App\Models\Lgu;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class LguController extends Controller
{
    /**
     * Display the LGU list.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', Lgu::class);

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'municipality_name'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'asc')
        );

        $allowedSortFields = [
            'municipality_name',
            'province',
            'region',
            'mayor_first_name',
            'mayor_middle_name',
            'mayor_last_name',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'municipality_name';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'asc';
        }

        $query = Lgu::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('municipality_name', 'like', $like)
                    ->orWhere('province', 'like', $like)
                    ->orWhere('region', 'like', $like)
                    ->orWhere('mayor_first_name', 'like', $like)
                    ->orWhere('mayor_middle_name', 'like', $like)
                    ->orWhere('mayor_last_name', 'like', $like);
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

    /**
     * Display the form for creating an LGU.
     */
    public function create(): Response
    {
        Gate::authorize('create', Lgu::class);

        return Inertia::render('LGUs/Create');
    }

    /**
     * Store a new LGU.
     */
    public function store(StoreLguRequest $request): RedirectResponse
    {
        Gate::authorize('create', Lgu::class);

        Lgu::create($request->validated());

        return to_route('lgus.index')
            ->with('message', 'Successfully created a new LGU.');
    }

    /**
     * Display a specific LGU.
     */
    public function show(Lgu $lgu): Response
    {
        Gate::authorize('view', $lgu);

        return Inertia::render('LGUs/Show', [
            'lgu' => $lgu,
        ]);
    }

    /**
     * Display the form for editing an LGU.
     */
    public function edit(Lgu $lgu): Response
    {
        Gate::authorize('update', $lgu);

        return Inertia::render('LGUs/Edit', [
            'lgu' => $lgu,
        ]);
    }

    /**
     * Update an existing LGU.
     */
    public function update(
        UpdateLguRequest $request,
        Lgu $lgu
    ): RedirectResponse {
        Gate::authorize('update', $lgu);

        $lgu->update($request->validated());

        return to_route('lgus.index', $request->query())
            ->with('message', 'Successfully updated the LGU.');
    }

    /**
     * Delete an LGU only when it has no dependent records.
     */
    public function destroy(Lgu $lgu): RedirectResponse
    {
        Gate::authorize('delete', $lgu);

        // TEMPORARY SAFETY GUARD: the shared database has no EngineerLGU table.
        // The deployed engineers.lgus_id also references LGUs, so the old
        // dependency check cannot establish that deletion is safe.
        // Restore delete functionality only after the team approves the
        // complete FK dependency check and transactional AuditLog workflow.
        abort(409, 'LGU deletion is disabled until EngineerLGU and existing engineer dependencies are safely reconciled.');
    }
}
