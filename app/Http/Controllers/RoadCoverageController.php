<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoadCoverageRequest;
use App\Http\Requests\UpdateRoadCoverageRequest;
use App\Models\AuditLog;
use App\Models\Lgu;
use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class RoadCoverageController extends Controller
{
    /**
     * Fields included in RoadCoverage audit snapshots.
     */
    private const AUDITABLE_FIELDS = [
        'road_name',
        'lgu_id',
        'kilometers',
        'pavement_type',
        'state_category',
        'geojson',
        'created_by',
    ];

    /**
     * Display RoadCoverage records.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', RoadCoverage::class);

        $actorAccount = $this->authenticatedUserAccount();

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'road_name'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'asc')
        );

        $allowedSortFields = [
            'road_name',
            'kilometers',
            'pavement_type',
            'state_category',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'road_name';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'asc';
        }

        $query = RoadCoverage::query()->with([
            'lgu',
            'createdBy',
        ]);

        /*
         * Users with viewAll permission may see all coverage records.
         * Other users are restricted to coverage in LGUs where they
         * have an active EngineerLGU assignment.
         */
        if (! Gate::allows('viewAll', RoadCoverage::class)) {
            $this->scopeToAssignedLgus($query, $actorAccount);
        }

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%' . $search . '%';

                $query->where('road_name', 'like', $like)
                    ->orWhereHas(
                        'lgu',
                        fn (Builder $lguQuery) => $lguQuery
                            ->where('municipality_name', 'like', $like)
                    );
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        $lguModel = new Lgu();

        return Inertia::render('RoadCoverages/Index', [
            'model' => $model,
            'lgus' => $this->availableLgus()->get([
                $lguModel->getKeyName(),
                'municipality_name',
            ]),
            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Display the create form.
     */
    public function create(): Response
    {
        Gate::authorize('create', RoadCoverage::class);

        return Inertia::render('RoadCoverages/Create', [
            'lgus' => $this->availableLgus()->get(),
        ]);
    }

    /**
     * Create a complete RoadCoverage.
     */
    public function store(
        StoreRoadCoverageRequest $request
    ): RedirectResponse {
        Gate::authorize('create', RoadCoverage::class);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'road_name',
            'lgu_id',
            'kilometers',
            'pavement_type',
            'state_category',
            'geojson',
        ]);

        $lgu = Lgu::query()->findOrFail($data['lgu_id']);

        /*
         * The policy must check the active EngineerLGU assignment
         * for this LGU and permit authorized administrator overrides.
         */
        Gate::authorize(
            'createForLgu',
            [RoadCoverage::class, $lgu]
        );

        /*
         * RoadCoverage.CreatedBy references Engineer.EngineerID,
         * not UserAccount.UserID.
         */
        if ($actorAccount->engineer_id === null) {
            abort(
                403,
                'The authenticated account is not linked to an Engineer. '
                . 'A valid Engineer creator must be established.'
            );
        }

        $data['created_by'] = $actorAccount->engineer_id;

        DB::transaction(function () use (
            $data,
            $actorAccount
        ): void {
            $roadCoverage = RoadCoverage::create($data);

            $this->writeAuditLog(
                $actorAccount,
                'CREATE',
                $roadCoverage,
                null,
                $this->auditValues($roadCoverage)
            );
        });

        return to_route('road-coverages.index')
            ->with(
                'message',
                'Successfully created a RoadCoverage.'
            );
    }

    /**
     * Display a RoadCoverage.
     */
    public function show(RoadCoverage $roadCoverage): Response
    {
        Gate::authorize('view', $roadCoverage);

        $roadCoverage->load([
            'lgu',
            'createdBy',
        ]);

        return Inertia::render('RoadCoverages/Show', [
            'roadCoverage' => $roadCoverage,
        ]);
    }

    /**
     * Display the edit form.
     */
    public function edit(RoadCoverage $roadCoverage): Response
    {
        Gate::authorize('update', $roadCoverage);

        $roadCoverage->load('lgu');

        return Inertia::render('RoadCoverages/Edit', [
            'roadCoverage' => $roadCoverage,
            'lgus' => $this->availableLgus()->get(),
        ]);
    }

    /**
     * Update a RoadCoverage.
     */
    public function update(
        UpdateRoadCoverageRequest $request,
        RoadCoverage $roadCoverage
    ): RedirectResponse {
        Gate::authorize('update', $roadCoverage);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'road_name',
            'lgu_id',
            'kilometers',
            'pavement_type',
            'state_category',
            'geojson',
        ]);

        $targetLgu = Lgu::query()->findOrFail($data['lgu_id']);

        /*
         * The policy must verify permission for the selected LGU.
         * Ordinary updates must never change CreatedBy.
         */
        Gate::authorize(
            'updateForLgu',
            [$roadCoverage, $targetLgu]
        );

        DB::transaction(function () use (
            $roadCoverage,
            $data,
            $actorAccount
        ): void {
            $record = RoadCoverage::query()
                ->lockForUpdate()
                ->findOrFail($roadCoverage->getKey());

            Gate::authorize('update', $record);

            $oldValues = $this->auditValues($record);

            $record->fill($data);

            $changedFields = array_values(array_intersect(
                self::AUDITABLE_FIELDS,
                array_keys($record->getDirty())
            ));

            // Do not create audit events for unchanged submissions.
            if ($changedFields === []) {
                return;
            }

            $changedKeys = array_flip($changedFields);

            $oldValues = array_intersect_key(
                $oldValues,
                $changedKeys
            );

            $record->save();

            $newValues = array_intersect_key(
                $this->auditValues($record),
                $changedKeys
            );

            $this->writeAuditLog(
                $actorAccount,
                'UPDATE',
                $record,
                $oldValues,
                $newValues
            );
        });

        return to_route(
            'road-coverages.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated the RoadCoverage.'
        );
    }

    /**
     * Delete a RoadCoverage only if no MaintenanceProject references it.
     */
    public function destroy(
        RoadCoverage $roadCoverage
    ): RedirectResponse {
        Gate::authorize('delete', $roadCoverage);

        $actorAccount = $this->authenticatedUserAccount();

        $deleted = DB::transaction(function () use (
            $roadCoverage,
            $actorAccount
        ): bool {
            $record = RoadCoverage::query()
                ->lockForUpdate()
                ->findOrFail($roadCoverage->getKey());

            Gate::authorize('delete', $record);

            $project = new MaintenanceProject();

            $isReferenced = MaintenanceProject::query()
                ->where(
                    'road_coverage_id',
                    $record->getKey()
                )
                ->exists();

            if ($isReferenced) {
                return false;
            }

            $oldValues = $this->auditValues($record);

            $record->delete();

            $this->writeAuditLog(
                $actorAccount,
                'DELETE',
                $record,
                $oldValues,
                null
            );

            return true;
        });

        if (! $deleted) {
            return to_route('road-coverages.index')
                ->with(
                    'error',
                    'This RoadCoverage cannot be deleted because a '
                    . 'MaintenanceProject references it.'
                );
        }

        return to_route('road-coverages.index')
            ->with(
                'message',
                'Successfully deleted the RoadCoverage.'
            );
    }

    /**
     * Return LGUs available to the authenticated user.
     *
     * Requires Lgu::engineerAssignments() to return EngineerLGU rows.
     */
    private function availableLgus(): Builder
    {
        $actorAccount = $this->authenticatedUserAccount();
        $query = Lgu::query()->orderBy('municipality_name');

        if (! Gate::allows('viewAll', RoadCoverage::class)) {
            if ($actorAccount->engineer_id === null) {
                return $query->whereRaw('1 = 0');
            }

            $query->whereHas(
                'engineerAssignments',
                fn (Builder $assignmentQuery) => $assignmentQuery
                    ->where(
                        'engineer_id',
                        $actorAccount->engineer_id
                    )
                    ->where('is_active', true)
            );
        }

        return $query;
    }

    /**
     * Limit coverage records to active assigned LGUs.
     */
    private function scopeToAssignedLgus(
        Builder $query,
        UserAccount $actorAccount
    ): void {
        if ($actorAccount->engineer_id === null) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->whereHas(
            'lgu.engineerAssignments',
            fn (Builder $assignmentQuery) => $assignmentQuery
                ->where(
                    'engineer_id',
                    $actorAccount->engineer_id
                )
                ->where('is_active', true)
        );
    }

    /**
     * Resolve the authenticated identity to its UserAccount.
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
     * Return fields included in audit snapshots.
     *
     * @return array<string, mixed>
     */
    private function auditValues(RoadCoverage $roadCoverage): array
    {
        return array_intersect_key(
            $roadCoverage->getAttributes(),
            array_flip(self::AUDITABLE_FIELDS)
        );
    }

    /**
     * Create an audit event inside the current transaction.
     *
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    private function writeAuditLog(
        UserAccount $actorAccount,
        string $action,
        RoadCoverage $roadCoverage,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $description = match ($action) {
            'CREATE' => "RoadCoverage #{$roadCoverage->getKey()} was created.",
            'UPDATE' => "RoadCoverage #{$roadCoverage->getKey()} was updated.",
            'DELETE' => "RoadCoverage #{$roadCoverage->getKey()} was deleted.",
            default => "RoadCoverage #{$roadCoverage->getKey()} changed.",
        };

        AuditLog::create([
            'user_id' => $actorAccount->getKey(),
            'actor_identifier' => 'UserAccount#'
                . $actorAccount->getKey(),
            'action' => $action,
            'entity_type' => 'RoadCoverage',
            'entity_id' => $roadCoverage->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'recipient_user_id' => null,
            'notification_message' => null,
        ]);
    }
}
