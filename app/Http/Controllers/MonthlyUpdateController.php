
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMonthlyUpdateRequest;
use App\Http\Requests\UpdateMonthlyUpdateRequest;
use App\Models\AuditLog;
use App\Models\MaintenanceRecord;
use App\Models\MonthlyUpdate;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MonthlyUpdateController extends Controller
{
    /**
     * Fields that may appear in monthly-update audit snapshots.
     */
    private const AUDITABLE_FIELDS = [
        'maintenance_id',
        'update_month',
        'progress_percentage',
        'summary_of_text_reports',
        'created_by',
    ];

    /**
     * Display monthly updates.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $actorAccount = $this->authenticatedUserAccount();

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'update_month'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'desc')
        );

        $allowedSortFields = [
            'update_month',
            'progress_percentage',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'update_month';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = MonthlyUpdate::query()->with([
            'maintenanceRecord.maintenanceProject',
            'createdBy',
        ]);

        /*
         * The MonthlyUpdatePolicy must grant viewAll only to roles
         * authorized to view the complete monthly-update history.
         */
        if (! Gate::allows('viewAll', MonthlyUpdate::class)) {
            if ($actorAccount->engineer_id === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas(
                    'maintenanceRecord',
                    fn (Builder $recordQuery) => $recordQuery
                        ->where(
                            'managing_engineer_id',
                            $actorAccount->engineer_id
                        )
                );
            }
        }

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('update_month', 'like', $like)
                    ->orWhere(
                        'summary_of_text_reports',
                        'like',
                        $like
                    )
                    ->orWhereHas(
                        'maintenanceRecord',
                        function (Builder $recordQuery) use ($search, $like): void {
                            $recordQuery
                                ->where('quarter', 'like', $like)
                                ->orWhereHas(
                                    'maintenanceProject',
                                    fn (Builder $projectQuery) => $projectQuery
                                        ->where('project_title', 'like', $like)
                                );

                            if (is_numeric($search)) {
                                $recordQuery->orWhere(
                                    'maintenance_year',
                                    (int) $search
                                );
                            }
                        }
                    );
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        /*
         * Limit the selection list for users who cannot view all records.
         * The policy must still check the actual assignment when saving.
         */
        $maintenanceRecordsQuery = MaintenanceRecord::query()
            ->with('maintenanceProject')
            ->orderByDesc('maintenance_year')
            ->orderBy('quarter');

        if (! Gate::allows('viewAll', MonthlyUpdate::class)) {
            if ($actorAccount->engineer_id === null) {
                $maintenanceRecordsQuery->whereRaw('1 = 0');
            } else {
                $maintenanceRecordsQuery->where(
                    'managing_engineer_id',
                    $actorAccount->engineer_id
                );
            }
        }

        return Inertia::render('MonthlyUpdates/Index', [
            'model' => $model,
            'maintenanceRecords' => $maintenanceRecordsQuery->get(),
            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Display the form for creating a monthly update.
     */
    public function create(): Response
    {
        Gate::authorize('create', MonthlyUpdate::class);

        return Inertia::render('MonthlyUpdates/Create', [
            'maintenanceRecords' => $this->availableMaintenanceRecords(),
        ]);
    }

    /**
     * Store a monthly update.
     */
    public function store(
        StoreMonthlyUpdateRequest $request
    ): RedirectResponse {
        Gate::authorize('create', MonthlyUpdate::class);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'maintenance_id',
            'update_month',
            'progress_percentage',
            'summary_of_text_reports',
        ]);

        $maintenanceRecord = MaintenanceRecord::query()
            ->findOrFail($data['maintenance_id']);

        /*
         * Requires MonthlyUpdatePolicy::createForRecord().
         * That policy must check the assigned managing Engineer
         * and the required active EngineerLGU assignment.
         */
        Gate::authorize(
            'createForRecord',
            [MonthlyUpdate::class, $maintenanceRecord]
        );

        DB::transaction(function () use (
            $data,
            $actorAccount
        ): void {
            $data['created_by'] = $actorAccount->getKey();

            $monthlyUpdate = MonthlyUpdate::create($data);

            $this->writeAuditLog(
                $actorAccount,
                'CREATE',
                $monthlyUpdate,
                null,
                $this->auditValues($monthlyUpdate)
            );
        });

        return to_route('monthly-updates.index')
            ->with(
                'message',
                'Successfully created a monthly update.'
            );
    }

    /**
     * Display a specific monthly update.
     */
    public function show(MonthlyUpdate $monthlyUpdate): Response
    {
        Gate::authorize('view', $monthlyUpdate);

        $monthlyUpdate->load([
            'maintenanceRecord.maintenanceProject',
            'createdBy',
            'media',
        ]);

        return Inertia::render('MonthlyUpdates/Show', [
            'monthlyUpdate' => $monthlyUpdate,
        ]);
    }

    /**
     * Display the form for editing a monthly update.
     */
    public function edit(MonthlyUpdate $monthlyUpdate): Response
    {
        Gate::authorize('update', $monthlyUpdate);

        $monthlyUpdate->load([
            'maintenanceRecord.maintenanceProject',
        ]);

        return Inertia::render('MonthlyUpdates/Edit', [
            'monthlyUpdate' => $monthlyUpdate,
            'maintenanceRecords' => $this->availableMaintenanceRecords(),
        ]);
    }

    /**
     * Update a monthly update.
     */
    public function update(
        UpdateMonthlyUpdateRequest $request,
        MonthlyUpdate $monthlyUpdate
    ): RedirectResponse {
        Gate::authorize('update', $monthlyUpdate);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'maintenance_id',
            'update_month',
            'progress_percentage',
            'summary_of_text_reports',
        ]);

        $targetMaintenanceRecord = MaintenanceRecord::query()
            ->findOrFail($data['maintenance_id']);

        /*
         * Also check permission for the selected parent record.
         * This matters if an update is moved to another maintenance.
         */
        Gate::authorize(
            'createForRecord',
            [MonthlyUpdate::class, $targetMaintenanceRecord]
        );

        DB::transaction(function () use (
            $monthlyUpdate,
            $data,
            $actorAccount
        ): void {
            $record = MonthlyUpdate::query()
                ->lockForUpdate()
                ->findOrFail($monthlyUpdate->getKey());

            Gate::authorize('update', $record);

            $oldValues = $this->auditValues($record);

            $record->fill($data);

            $changedFields = array_values(array_intersect(
                self::AUDITABLE_FIELDS,
                array_keys($record->getDirty())
            ));

            // Unchanged submissions must not create duplicate audit entries.
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
            'monthly-updates.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated a monthly update.'
        );
    }

    /**
     * Delete a monthly update.
     *
     * Engineers must not be permitted to delete monthly updates.
     * Attached Media must be handled explicitly before deletion.
     */
    public function destroy(
        MonthlyUpdate $monthlyUpdate
    ): RedirectResponse {
        Gate::authorize('delete', $monthlyUpdate);

        $actorAccount = $this->authenticatedUserAccount();

        $deleted = DB::transaction(function () use (
            $monthlyUpdate,
            $actorAccount
        ): bool {
            $record = MonthlyUpdate::query()
                ->lockForUpdate()
                ->findOrFail($monthlyUpdate->getKey());

            Gate::authorize('delete', $record);

            if ($record->media()->exists()) {
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
            return to_route('monthly-updates.index')
                ->with(
                    'error',
                    'This monthly update cannot be deleted while Media '
                    .'records remain attached. Handle the related media '
                    .'records and stored files explicitly first.'
                );
        }

        return to_route('monthly-updates.index')
            ->with(
                'message',
                'Successfully deleted a monthly update.'
            );
    }

    /**
     * Return maintenance records available for the selection list.
     */
    private function availableMaintenanceRecords()
    {
        $actorAccount = $this->authenticatedUserAccount();

        $query = MaintenanceRecord::query()
            ->with('maintenanceProject')
            ->orderByDesc('maintenance_year')
            ->orderBy('quarter');

        if (! Gate::allows('viewAll', MonthlyUpdate::class)) {
            if ($actorAccount->engineer_id === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where(
                    'managing_engineer_id',
                    $actorAccount->engineer_id
                );
            }
        }

        return $query->get();
    }

    /**
     * Resolve the authenticated identity to its UserAccount.
     *
     * If the app uses a separate authentication model, that model
     * must expose a userAccount relationship.
     */
    private function authenticatedUserAccount(): UserAccount
    {
        $user = Auth::user();

        if ($user instanceof UserAccount) {
            return $user;
        }

        if (
            $user !== null
            && method_exists($user, 'userAccount')
        ) {
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
     * Get the fields included in audit snapshots.
     *
     * @return array<string, mixed>
     */
    private function auditValues(MonthlyUpdate $monthlyUpdate): array
    {
        return array_intersect_key(
            $monthlyUpdate->getAttributes(),
            array_flip(self::AUDITABLE_FIELDS)
        );
    }

    /**
     * Save an audit event in the current database transaction.
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    private function writeAuditLog(
        UserAccount $actorAccount,
        string $action,
        MonthlyUpdate $monthlyUpdate,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $description = match ($action) {
            'CREATE' => "Monthly update #{$monthlyUpdate->getKey()} was created.",
            'UPDATE' => "Monthly update #{$monthlyUpdate->getKey()} was updated.",
            'DELETE' => "Monthly update #{$monthlyUpdate->getKey()} was deleted.",
            default => "Monthly update #{$monthlyUpdate->getKey()} changed.",
        };

        AuditLog::create([
            'user_id' => $actorAccount->getKey(),
            'actor_identifier' => 'UserAccount#'
                .$actorAccount->getKey(),
            'action' => $action,
            'entity_type' => 'MonthlyUpdate',
            'entity_id' => $monthlyUpdate->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'recipient_user_id' => null,
            'notification_message' => null,
        ]);
    }
}
