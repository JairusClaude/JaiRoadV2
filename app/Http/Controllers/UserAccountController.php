
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserAccountRequest;
use App\Http\Requests\UpdateUserAccountRequest;
use App\Models\AuditLog;
use App\Models\Engineer;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UserAccountController extends Controller
{
    /**
     * Fields allowed in audit snapshots.
     * Passwords and password hashes must never be included.
     */
    private const AUDITABLE_FIELDS = [
        'username',
        'email',
        'accountType',
        'engineer_id',
        'is_active',
    ];

    /**
     * Display user accounts without exposing password hashes.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', UserAccount::class);

        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query(
            'sort_field',
            'created_at'
        );
        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'desc')
        );

        $allowedSortFields = [
            'username',
            'email',
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

        $account = new UserAccount;

        $query = UserAccount::query()->select([
            $account->getKeyName(),
            'username',
            'email',
            'accountType',
            'engineer_id',
            'is_active',
            'created_at',
            'updated_at',
        ]);

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('username', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('accountType', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('UserAccounts/Index', [
            'model' => $model,
            'engineers' => $this->availableEngineers(),
            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Display the create form.
     */
    public function create(): Response
    {
        Gate::authorize('create', UserAccount::class);

        return Inertia::render('UserAccounts/Create', [
            'engineers' => $this->availableEngineers(),
        ]);
    }

    /**
     * Create a user account.
     */
    public function store(
        StoreUserAccountRequest $request
    ): RedirectResponse {
        Gate::authorize('create', UserAccount::class);

        $actor = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'username',
            'email',
            'password',
            'accountType',
            'engineer_id',
        ]);

        $accountType = (string) ($data['accountType'] ?? '');
        $engineerId = $data['engineer_id'] ?? null;

        $data['engineer_id'] = $this->validatedEngineerId(
            $accountType,
            $engineerId
        );

        $data['password'] = Hash::make($data['password']);

        // New accounts are active by default.
        // Do not let the client decide the initial activity state.
        $data['is_active'] = true;

        DB::transaction(function () use ($data, $actor): void {
            $userAccount = UserAccount::create($data);

            $this->writeAuditLog(
                $actor,
                'CREATE',
                $userAccount,
                null,
                $this->auditValues($userAccount)
            );
        });

        return to_route('user-accounts.index')
            ->with('message', 'Successfully created a user account.');
    }

    /**
     * Display a user account without exposing its password hash.
     */
    public function show(UserAccount $userAccount): Response
    {
        Gate::authorize('view', $userAccount);

        return Inertia::render('UserAccounts/Show', [
            'userAccount' => $this->safeAccountData($userAccount),
        ]);
    }

    /**
     * Display the edit form.
     */
    public function edit(UserAccount $userAccount): Response
    {
        Gate::authorize('update', $userAccount);

        return Inertia::render('UserAccounts/Edit', [
            'userAccount' => $this->safeAccountData($userAccount),
            'engineers' => $this->availableEngineers(
                $userAccount->getKey()
            ),
        ]);
    }

    /**
     * Update account details without exposing the password hash.
     */
    public function update(
        UpdateUserAccountRequest $request,
        UserAccount $userAccount
    ): RedirectResponse {
        Gate::authorize('update', $userAccount);

        $actor = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'username',
            'email',
            'password',
            'accountType',
            'engineer_id',
            'is_active',
        ]);

        $accountType = (string) (
            $data['accountType'] ?? $userAccount->accountType
        );

        $engineerId = array_key_exists('engineer_id', $data)
            ? $data['engineer_id']
            : $userAccount->engineer_id;

        // Enforce the role-to-Engineer relationship on every update.
        $data['engineer_id'] = $this->validatedEngineerId(
            $accountType,
            $engineerId,
            $userAccount->getKey()
        );

        // Empty passwords mean "keep the current password".
        if (filled($data['password'] ?? null)) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        DB::transaction(function () use (
            $userAccount,
            $data,
            $actor
        ): void {
            $record = UserAccount::query()
                ->lockForUpdate()
                ->findOrFail($userAccount->getKey());

            Gate::authorize('update', $record);

            $oldValues = $this->auditValues($record);

            $record->fill($data);

            $dirtyFields = array_keys($record->getDirty());

            if ($dirtyFields === []) {
                return;
            }

            $changedFields = array_values(array_intersect(
                self::AUDITABLE_FIELDS,
                $dirtyFields
            ));

            $record->save();

            $newValues = $this->auditValues($record);

            $oldSnapshot = array_intersect_key(
                $oldValues,
                array_flip($changedFields)
            );

            $newSnapshot = array_intersect_key(
                $newValues,
                array_flip($changedFields)
            );

            // The password may have changed, but its value is never logged.
            $oldSnapshot = $oldSnapshot === [] ? null : $oldSnapshot;
            $newSnapshot = $newSnapshot === [] ? null : $newSnapshot;

            $action = 'UPDATE';

            if (
                (bool) $oldValues['is_active']
                && ! (bool) $newValues['is_active']
            ) {
                $action = 'DEACTIVATE';
            } elseif (
                ! (bool) $oldValues['is_active']
                && (bool) $newValues['is_active']
            ) {
                $action = 'ACTIVATE';
            } elseif (
                (string) ($oldValues['engineer_id'] ?? '')
                !== (string) ($newValues['engineer_id'] ?? '')
            ) {
                $action = 'REASSIGN';
            }

            $this->writeAuditLog(
                $actor,
                $action,
                $record,
                $oldSnapshot,
                $newSnapshot
            );
        });

        return to_route(
            'user-accounts.index',
            $request->query()
        )->with('message', 'Successfully updated a user account.');
    }

    /**
     * Deactivate an account instead of permanently deleting it.
     */
    public function destroy(UserAccount $userAccount): RedirectResponse
    {
        Gate::authorize('delete', $userAccount);

        $actor = $this->authenticatedUserAccount();

        $deactivated = DB::transaction(function () use (
            $userAccount,
            $actor
        ): bool {
            $record = UserAccount::query()
                ->lockForUpdate()
                ->findOrFail($userAccount->getKey());

            // The policy's delete permission authorizes deactivation,
            // not a physical database deletion.
            Gate::authorize('delete', $record);

            if (! (bool) $record->is_active) {
                return false;
            }

            $oldValues = $this->auditValues($record);

            $record->is_active = false;
            $record->save();

            $this->writeAuditLog(
                $actor,
                'DEACTIVATE',
                $record,
                $oldValues,
                $this->auditValues($record)
            );

            return true;
        });

        if (! $deactivated) {
            return to_route('user-accounts.index')
                ->with('message', 'This account is already inactive.');
        }

        return to_route('user-accounts.index')
            ->with('message', 'Successfully deactivated the user account.');
    }

    /**
     * Enforce account-type linkage and one account per Engineer.
     *
     * Admin and Engineer must have an Engineer profile.
     * SuperAdmin and Viewer must not have one.
     */
    private function validatedEngineerId(
        string $accountType,
        mixed $engineerId,
        mixed $ignoreAccountId = null
    ): mixed {
        if (! in_array($accountType, [
            'SuperAdmin',
            'Admin',
            'Engineer',
            'Viewer',
        ], true)) {
            throw ValidationException::withMessages([
                'accountType' => 'Select a valid account type.',
            ]);
        }

        if (in_array($accountType, ['SuperAdmin', 'Viewer'], true)) {
            return null;
        }

        if (blank($engineerId)) {
            throw ValidationException::withMessages([
                'engineer_id' => 'An Engineer profile is required for Admin and Engineer accounts.',
            ]);
        }

        $engineer = Engineer::query()->find($engineerId);

        if ($engineer === null) {
            throw ValidationException::withMessages([
                'engineer_id' => 'The selected Engineer does not exist.',
            ]);
        }

        $alreadyLinked = UserAccount::query()
            ->where('engineer_id', $engineer->getKey())
            ->when(
                $ignoreAccountId !== null,
                fn (Builder $query) => $query->where(
                    (new UserAccount)->getKeyName(),
                    '<>',
                    $ignoreAccountId
                )
            )
            ->exists();

        if ($alreadyLinked) {
            throw ValidationException::withMessages([
                'engineer_id' => 'This Engineer already has a linked user account.',
            ]);
        }

        return $engineer->getKey();
    }

    /**
     * Return Engineers for the account form without unnecessary fields.
     */
    private function availableEngineers(mixed $currentAccountId = null)
    {
        $engineer = new Engineer;

        $query = Engineer::query()
            ->select([
                $engineer->getKeyName(),
                'first_name',
                'middle_name',
                'last_name',
                'engineer_status',
            ])
            ->orderBy('last_name')
            ->whereNotExists(function ($subquery) use (
                $engineer,
                $currentAccountId
            ): void {
                $account = new UserAccount;

                $subquery->selectRaw('1')
                    ->from($account->getTable())
                    ->whereColumn(
                        $account->getTable().'.engineer_id',
                        $engineer->getTable().'.'.$engineer->getKeyName()
                    );

                if ($currentAccountId !== null) {
                    $subquery->where(
                        $account->getTable().'.'.$account->getKeyName(),
                        '<>',
                        $currentAccountId
                    );
                }
            });

        return $query->get();
    }

    /**
     * Resolve the authenticated identity to UserAccount.
     */
    private function authenticatedUserAccount(): UserAccount
    {
        $user = Auth::user();

        if ($user instanceof UserAccount) {
            return $user;
        }

        if ($user !== null && method_exists($user, 'userAccount')) {
            $account = $user->userAccount;

            if ($account instanceof UserAccount) {
                return $account;
            }
        }

        abort(
            403,
            'The authenticated user is not linked to a UserAccount.'
        );
    }

    /**
     * Return safe data for Inertia; never expose password hashes.
     *
     * @return array<string, mixed>
     */
    private function safeAccountData(UserAccount $userAccount): array
    {
        return $userAccount->only([
            $userAccount->getKeyName(),
            'username',
            'email',
            'accountType',
            'engineer_id',
            'is_active',
            'created_at',
            'updated_at',
        ]);
    }

    /**
     * Create an audit snapshot without credentials.
     *
     * @return array<string, mixed>
     */
    private function auditValues(UserAccount $userAccount): array
    {
        return [
            'username' => $userAccount->username,
            'email' => $userAccount->email,
            'accountType' => $userAccount->accountType,
            'engineer_id' => $userAccount->engineer_id,
            'is_active' => (bool) $userAccount->is_active,
        ];
    }

    /**
     * Save an audit event inside the account-change transaction.
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    private function writeAuditLog(
        UserAccount $actor,
        string $action,
        UserAccount $target,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $description = match ($action) {
            'CREATE' => "UserAccount #{$target->getKey()} was created.",
            'UPDATE' => "UserAccount #{$target->getKey()} was updated.",
            'REASSIGN' => "UserAccount #{$target->getKey()} Engineer linkage changed.",
            'ACTIVATE' => "UserAccount #{$target->getKey()} was activated.",
            'DEACTIVATE' => "UserAccount #{$target->getKey()} was deactivated.",
            default => "UserAccount #{$target->getKey()} changed.",
        };

        AuditLog::create([
            'user_id' => $actor->getKey(),
            'actor_identifier' => $actor->username.' (UserAccount #'.$actor->getKey().')',
            'action' => $action,
            'entity_type' => 'UserAccount',
            'entity_id' => $target->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'recipient_user_id' => null,
            'notification_message' => null,
        ]);
    }
}
