<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEngineerRequest;
use App\Http\Requests\UpdateEngineerRequest;
use App\Models\Engineer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class EngineerController extends Controller
{
    /**
     * Display the engineer directory.
     *
     * All permitted directory users may read engineer records.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Engineer::class);

        $search = trim((string) $request->query('search', ''));

        $sortField = (string) $request->query(
            'sort_field',
            'created_at'
        );

        $sortDirection = strtolower(
            (string) $request->query('sort_direction', 'desc')
        );

        $allowedSortFields = [
            'first_name',
            'middle_name',
            'last_name',
            'contact_no',
            'rank',
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
                    ->orWhere('contact_no', 'like', $like)
                    ->orWhere('rank', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Engineers/Index', [
            'model' => $model,
            'queryParams' => $request->query(),
        ]);
    }

    /**
     * Create an Engineer record.
     *
     * Only Admin/SuperAdmin should be authorized by EngineerPolicy.
     * The audit entry is written in the same transaction.
     */
    public function store(StoreEngineerRequest $request): RedirectResponse
    {
        Gate::authorize('create', Engineer::class);

        abort(409, 'Engineer creation is unavailable until the required EngineerStatus schema and rules are approved.');
    }

    /**
     * Update an Engineer record or change its employment status.
     *
     * Retired engineers are retained; they are never hard-deleted.
     */
    public function update(UpdateEngineerRequest $request, Engineer $engineer): RedirectResponse
    {
        Gate::authorize('update', $engineer);

        abort(409, 'Engineer updates and retirement changes are unavailable until the required EngineerStatus schema and rules are approved.');
    }

}
