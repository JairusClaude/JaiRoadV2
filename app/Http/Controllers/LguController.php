<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLguRequest;
use App\Http\Requests\UpdateLguRequest;
use App\Models\Lgu;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class LguController extends Controller
{
    /**
     * Display the LGU list.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Lgu::class);

        $search = trim((string) $request->query('search', ''));
        $province = trim((string) $request->query('province', ''));
        $region = trim((string) $request->query('region', ''));
        $sort = strtolower((string) $request->query('sort', 'asc')) === 'desc' ? 'desc' : 'asc';

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

        if ($province !== '' && $province !== 'all') {
            $query->where('province', $province);
        }

        if ($region !== '' && $region !== 'all') {
            $query->where('region', $region);
        }

        $paginated = $query
            ->orderBy('municipality_name', $sort)
            ->paginate(10)
            ->withQueryString();

        $lgus = [
            'data' => collect($paginated->items())->map(function (Lgu $lgu): array {
                $roadCount = DB::table('jairoads_next.road_coverages')->where('lgu_id', $lgu->id)->count();
                $assignmentCount = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $lgu->id)->where('is_active', true)->count();

                return [
                    'id' => (int) $lgu->id,
                    'municipality_name' => $lgu->municipality_name,
                    'province' => $lgu->province,
                    'region' => $lgu->region,
                    'mayor_first_name' => $lgu->mayor_first_name,
                    'mayor_middle_name' => $lgu->mayor_middle_name,
                    'mayor_last_name' => $lgu->mayor_last_name,
                    'deletion_check' => [
                        'available' => true,
                        'road_coverages' => $roadCount,
                        'engineer_assignments' => $assignmentCount,
                    ],
                ];
            })->all(),
            'total' => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'from' => $paginated->firstItem(),
            'to' => $paginated->lastItem(),
        ];

        $provinces = Lgu::query()->distinct()->whereNotNull('province')->orderBy('province')->pluck('province')->all();
        $regions = Lgu::query()->distinct()->whereNotNull('region')->orderBy('region')->pluck('region')->all();

        return Inertia::render('LGUs/Index', [
            'lgus' => $lgus,
            'filters' => [
                'search' => $search,
                'province' => $province,
                'region' => $region,
                'sort' => $sort,
            ],
            'provinces' => $provinces,
            'regions' => $regions,
            'lguPermissions' => [
                'can_edit' => true,
                'can_delete' => true,
            ],
            'canBulkDelete' => true,
            'canDelete' => true,
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

        $hasRoads = DB::table('jairoads_next.road_coverages')->where('lgu_id', $lgu->id)->exists();
        $hasAssignments = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $lgu->id)->exists();

        if ($hasRoads || $hasAssignments) {
            return back()->withErrors(['delete' => "Cannot delete LGU {$lgu->municipality_name} because it has linked road coverages or engineer assignments."]);
        }

        DB::transaction(function () use ($lgu): void {
            $lgu->delete();
        });

        return to_route('lgus.index')->with('message', 'Successfully deleted the LGU.');
    }

    public function bulkDestroy(Request $request): RedirectResponse
    {
        Gate::authorize('viewAny', Lgu::class);

        $ids = $request->input('lgu_ids', []);
        if (is_array($ids) && count($ids) > 0) {
            DB::transaction(function () use ($ids): void {
                foreach ($ids as $id) {
                    $hasRoads = DB::table('jairoads_next.road_coverages')->where('lgu_id', $id)->exists();
                    $hasAssignments = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $id)->exists();
                    if (!$hasRoads && !$hasAssignments) {
                        Lgu::destroy($id);
                    }
                }
            });
        }

        return to_route('lgus.index')->with('message', 'Selected LGUs processed for deletion.');
    }
}
