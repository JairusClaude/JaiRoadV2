<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserAccountRequest;
use App\Http\Requests\UpdateUserAccountRequest;
use App\Models\Engineer;
use App\Models\UserAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserAccountController extends Controller
{
    public function index(): Response
    {
        $model = UserAccount::query()
            ->where(
                'username',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'role',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('UserAccounts/Index', [
            'model' => $model,
            'engineers' => Engineer::orderBy(
                'last_name',
                'asc'
            )->get(),
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

        if (isset($data['password'])) {
            $data['password'] = Hash::make(
                $data['password']
            );
        }

        UserAccount::create($data);

        session()->flash(
            'message',
            'Successfully created a user account'
        );

        return redirect(
            route('user-accounts.index')
        );
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

        if (
            isset($data['password']) &&
            $data['password'] !== ''
        ) {
            $data['password'] = Hash::make(
                $data['password']
            );
        } else {
            unset($data['password']);
        }

        $userAccount->update($data);

        session()->flash(
            'message',
            'Successfully updated a user account'
        );

        return redirect(
            route(
                'user-accounts.index',
                $request->query()
            )
        );
    }

    public function destroy(UserAccount $userAccount): RedirectResponse
    {
        $userAccount->delete();

        session()->flash(
            'message',
            'Successfully deleted a user account'
        );

        return redirect(
            route('user-accounts.index')
        );
    }
}
