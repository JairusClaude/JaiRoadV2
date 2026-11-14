<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserAccountRequest;
use App\Http\Requests\UpdateUserAccountRequest;
use App\Models\Engineer;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Temporary schema-compatible UserAccount controller.
 *
 * UserAccountPolicy currently denies every ability, including viewAny/view.
 * The separate verified /user-management preview is not changed by this file.
 * Do not enable account mutations until the identity, role, validation, and
 * user_accounts schema discrepancies are resolved and approved.
 */
class UserAccountController extends Controller
{
    /**
     * Read only the columns that exist in the deployed user_accounts table.
     * The existing UserAccountPolicy still denies this action.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', UserAccount::class);

        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        if (! in_array($sortField, [
            'username', 'accountType', 'is_active', 'created_at',
        ], true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = UserAccount::query()->select([
            'id', 'username', 'accountType', 'engineers_id', 'is_active',
            'created_at', 'updated_at',
        ]);

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where('username', 'like', $like)
                    ->orWhere('accountType', 'like', $like);
            });
        }

        return Inertia::render('UserAccounts/Index', [
            'model' => $query->orderBy($sortField, $sortDirection)
                ->paginate(10)
                ->withQueryString(),
            'engineers' => Engineer::query()
                ->select(['id', 'first_name', 'middle_name', 'last_name'])
                ->orderBy('last_name')
                ->get(),
            'queryParams' => request()->query(),
        ]);
    }

    public function show(UserAccount $userAccount): Response
    {
        Gate::authorize('view', $userAccount);

        // Password hashes and unsupported legacy fields are never serialized.
        return Inertia::render('UserAccounts/Show', [
            'userAccount' => $userAccount->only([
                'id', 'username', 'accountType', 'engineers_id',
                'is_active', 'created_at', 'updated_at',
            ]),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', UserAccount::class);
        abort(409, 'UserAccount creation is disabled pending schema and identity approval.');
    }

    public function store(StoreUserAccountRequest $request): RedirectResponse
    {
        Gate::authorize('create', UserAccount::class);
        abort(409, 'UserAccount creation is disabled pending schema and identity approval.');
    }

    public function edit(UserAccount $userAccount): Response
    {
        Gate::authorize('update', $userAccount);
        abort(409, 'UserAccount editing is disabled pending schema and identity approval.');
    }

    public function update(
        UpdateUserAccountRequest $request,
        UserAccount $userAccount
    ): RedirectResponse {
        Gate::authorize('update', $userAccount);
        abort(409, 'UserAccount updating is disabled pending schema and identity approval.');
    }

    /** UserAccount deletion remains soft-deactivation-only in the future design. */
    public function destroy(UserAccount $userAccount): RedirectResponse
    {
        Gate::authorize('delete', $userAccount);
        abort(409, 'UserAccount deactivation is disabled pending schema and identity approval.');
    }
}
