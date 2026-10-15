<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEngineerRequest;
use App\Http\Requests\UpdateEngineerRequest;
use App\Models\AuditLog;
use App\Models\Engineer;
use App\Models\User;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class EngineerController extends Controller
{
    /**
     * Fields included in Engineer audit snapshots.
     *
     * Email and Position are excluded because they are not
     * Engineer attributes in the supplied data dictionary.
     */
    private const AUDITABLE_FIELDS = [
        'first_name',
        'middle_name',
        'last_name',
        'contact_no',
        'rank',
        'engineer_status',
    ];

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
            'engineer_status',
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
                    ->orWhere('rank', 'like', $like)
                    ->orWhere('engineer_status', 'like', $like);
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
    public function store(
        StoreEngineerRequest $request
    ): RedirectResponse {
        Gate::authorize('create', Engineer::class);

        $data = $request->validated();

        // EngineerStatus defaults to Active in the data dictionary.
        $data += ['engineer_status' => 'Active'];

        DB::transaction(function () use ($request, $data): void {
            $engineer = Engineer::create($data);

            $this->writeAuditLog(
                $request,
                'CREATE',
                $engineer,
                null,
                $engineer->only(self::AUDITABLE_FIELDS)
            );
        });

        return to_route('engineers.index')
            ->with('message', 'Successfully created an engineer.');
    }

    /**
     * Update an Engineer record or change its employment status.
     *
     * Retired engineers are retained; they are never hard-deleted.
     */
    public function update(
        UpdateEngineerRequest $request,
        Engineer $engineer
    ): RedirectResponse {
        Gate::authorize('update', $engineer);

        $oldValues = $engineer->only(self::AUDITABLE_FIELDS);
        $previousStatus = (string) $engineer->engineer_status;

        $engineer->fill($request->validated());

        // Do not create an audit event when nothing actually changed.
        $changedFields = array_intersect(
            array_keys($engineer->getDirty()),
            self::AUDITABLE_FIELDS
        );

        if ($changedFields === []) {
            return to_route('engineers.index', $request->query())
                ->with('message', 'No engineer changes were made.');
        }

        $newStatus = (string) $engineer->engineer_status;

        // Use the specific status action rather than recording
        // a duplicate generic UPDATE event.
        $action = match (true) {
            $previousStatus !== 'Retired'
                && $newStatus === 'Retired' => 'RETIRE',

            $previousStatus === 'Retired'
                && $newStatus === 'Active' => 'ACTIVATE',

            default => 'UPDATE',
        };

        DB::transaction(function () use (
            $request,
            $engineer,
            $oldValues,
            $action
        ): void {
            $engineer->save();

            $this->writeAuditLog(
                $request,
                $action,
                $engineer,
                $oldValues,
                $engineer->only(self::AUDITABLE_FIELDS)
            );
        });

        return to_route('engineers.index', $request->query())
            ->with('message', 'Successfully updated an engineer.');
    }

    /**
     * Write an audit entry for a successful Engineer mutation.
     *
     * Actor identity is derived from the authenticated account,
     * never from submitted form data.
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    private function writeAuditLog(
        Request $request,
        string $action,
        Engineer $engineer,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $actor = $this->currentActiveUserAccount($request);

        $description = match ($action) {
            'CREATE' => "Engineer #{$engineer->getKey()} was created.",
            'RETIRE' => "Engineer #{$engineer->getKey()} was retired.",
            'ACTIVATE' => "Engineer #{$engineer->getKey()} was activated.",
            default => "Engineer #{$engineer->getKey()} was updated.",
        };

        AuditLog::create([
            'user_id' => $actor->getKey(),
            'actor_identifier' => $actor->username,
            'action' => $action,
            'entity_type' => 'Engineer',
            'entity_id' => $engineer->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,

            // Engineer mutations do not automatically create
            // recipient notifications.
            'recipient_user_id' => null,
            'notification_message' => null,
        ]);
    }

    /**
     * Resolve the authenticated Laravel User to its active UserAccount.
     */
    private function currentActiveUserAccount(
        Request $request
    ): UserAccount {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        $account = $user->userAccount()
            ->where('is_active', true)
            ->first();

        abort_unless(
            $account instanceof UserAccount,
            403,
            'An active UserAccount is required for this operation.'
        );

        return $account;
    }
}
