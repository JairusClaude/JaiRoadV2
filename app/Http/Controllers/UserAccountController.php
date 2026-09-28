<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserAccountRequest;
use App\Http\Requests\UpdateUserAccountRequest;
use App\Models\Engineer;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserAccountController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'username',
            'accountType',
            'is_active',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = UserAccount::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('username', 'like', $like)
                    ->orWhere('accountType', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('UserAccounts/Index', [
            'model' => $model,
            'engineers' => Engineer::query()
                ->orderBy('last_name')
                ->get(),
            'queryParams' => request()->query(),
        ]);
    }

    public function create(): void
    {
        //
    }

    public function store(
        StoreUserAccountRequest $request
    ): RedirectResponse {
        $data = $request->validated();

        $data['password'] = Hash::make($data['password']);

        UserAccount::create($data);

        return to_route('user-accounts.index')
            ->with('message', 'Successfully created a user account');
    }

    public function show(UserAccount $userAccount): void
    {
        //
    }

    public function edit(UserAccount $userAccount): void
    {
        //
    }

    public function update(
        UpdateUserAccountRequest $request,
        UserAccount $userAccount
    ): RedirectResponse {
        $data = $request->validated();

        if (filled($data['password'] ?? null)) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $userAccount->update($data);

        return to_route('user-accounts.index', $request->query())
            ->with('message', 'Successfully updated a user account');
    }

    public function destroy(UserAccount $userAccount): RedirectResponse
    {
        $userAccount->delete();

        return to_route('user-accounts.index')
            ->with('message', 'Successfully deleted a user account');
    }
}
