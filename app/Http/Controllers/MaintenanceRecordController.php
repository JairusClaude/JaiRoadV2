
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenanceRecordRequest;
use App\Http\Requests\UpdateMaintenanceRecordRequest;
use App\Models\AuditLog;
use App\Models\Engineer;
use App\Models\MaintenanceProject;
use App\Models\MaintenanceRecord;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class MaintenanceRecordController extends Controller
{
    /**
     * Fields included in maintenance-record audit snapshots.
     */
    private const AUDITABLE_FIELDS = [
        'project_id',
        'managing_engineer_id',
        'maintenance_year',
        'quarter',
        'start_date',
        'estimated_duration_days',
        'complete_date',
        'status',
        'description',
    ];

    /**
     * Display maintenance records.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', MaintenanceRecord::class);

        $actorAccount = $this->authenticatedUserAccount();

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'created_at'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'desc')
        );

        $allowedSortFields = [
            'maintenance_year',
            'quarter',
            'start_date',
            'estimated_duration_days',
            'complete_date',
            'status',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = MaintenanceRecord::query()->with([
            'maintenanceProject',
            'managingEngineer',
            'createdBy',
        ]);

        /*
         * The MaintenanceRecordPolicy must implement viewAll.
         * Users without permission to view every record are limited
         * to records managed by their linked Engineer account.
         */
        if (! Gate::allows('viewAll', MaintenanceRecord::class)) {
            if ($actorAccount->engineer_id === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where(
                    'managing_engineer_id',
                    $actorAccount->engineer_id
                );
            }
        }

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('quarter', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhereHas(
                        'maintenanceProject',
                        fn (Builder $projectQuery) => $projectQuery
                            ->where('project_title', 'like', $like)
                    )
                    ->orWhereHas(
                        'managingEngineer',
                        fn (Builder $engineerQuery) => $engineerQuery
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                    );

                if (is_numeric($search)) {
                    $query->orWhere(
                        'maintenance_year',
                        (int) $search
                    );
                }
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        $project = new MaintenanceProject;
        $engineer = new Engineer;

        return Inertia::render('MaintenanceRecords/Index', [
            'model' => $model,

            'maintenanceProjects' => MaintenanceProject::query()
                ->orderBy('project_title')
                ->get([
                    $project->getKeyName(),
                    'project_title',
                ]),

            'engineers' => Engineer::query()
                ->orderBy('last_name')
                ->get([
                    $engineer->getKeyName(),
                    'first_name',
                    'middle_name',
                    'last_name',
                ]),

            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Create a maintenance record.
     */
    public function store(
        StoreMaintenanceRecordRequest $request
    ): RedirectResponse {
        Gate::authorize('create', MaintenanceRecord::class);

        $actorAccount = $this->authenticatedUserAccount();

        /*
         * Only take fields defined for MaintenanceRecord.
         * CreatedBy is always assigned by the server.
         */
        $data = $request->safe()->only([
            'project_id',
            'managing_engineer_id',
            'maintenance_year',
            'quarter',
            'start_date',
            'estimated_duration_days',
            'complete_date',
            'status',
            'description',
        ]);

        $data['created_by'] = $actorAccount->getKey();

        DB::transaction(function () use (
            $data,
            $actorAccount
        ): void {
            $record = MaintenanceRecord::create($data);

            $this->writeAuditLog(
                $actorAccount,
                'CREATE',
                $record,
                null,
                $this->auditValues($record)
            );
        });

        return to_route('maintenance-records.index')
            ->with(
                'message',
                'Successfully created a maintenance record.'
            );
    }

    /**
     * Update a maintenance record without changing its manager.
     */
    public function update(
        UpdateMaintenanceRecordRequest $request,
        MaintenanceRecord $maintenanceRecord
    ): RedirectResponse {
        Gate::authorize('update', $maintenanceRecord);

        $actorAccount = $this->authenticatedUserAccount();

        /*
         * ManagingEngineerID and CreatedBy are intentionally excluded.
         * Reassignment must use a separate authorized, audited operation.
         */
        $data = $request->safe()->only([
            'project_id',
            'maintenance_year',
            'quarter',
            'start_date',
            'estimated_duration_days',
            'complete_date',
            'status',
            'description',
        ]);

        DB::transaction(function () use (
            $maintenanceRecord,
            $data,
            $actorAccount
        ): void {
            $record = MaintenanceRecord::query()
                ->lockForUpdate()
                ->findOrFail($maintenanceRecord->getKey());

            Gate::authorize('update', $record);

            $oldValues = $this->auditValues($record);

            $record->fill($data);

            $changedFields = array_values(array_intersect(
                self::AUDITABLE_FIELDS,
                array_keys($record->getDirty())
            ));

            // Do not create an audit event when nothing changed.
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
            'maintenance-records.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated a maintenance record.'
        );
    }

    /**
     * Delete a maintenance record when policy and dependencies permit it.
     */
    public function destroy(
        MaintenanceRecord $maintenanceRecord
    ): RedirectResponse {
        Gate::authorize('delete', $maintenanceRecord);

        $actorAccount = $this->authenticatedUserAccount();

        $deleted = DB::transaction(function () use (
            $maintenanceRecord,
            $actorAccount
        ): bool {
            $record = MaintenanceRecord::query()
                ->lockForUpdate()
                ->findOrFail($maintenanceRecord->getKey());

            Gate::authorize('delete', $record);

            /*
             * These relationship methods must exist on MaintenanceRecord.
             * Foreign keys should also use ON DELETE RESTRICT.
             */
            if (
                $record->monthlyUpdates()->exists()
                || $record->maintenanceDocuments()->exists()
            ) {
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
            return to_route('maintenance-records.index')
                ->with(
                    'error',
                    'This maintenance record cannot be deleted while '
                    .'monthly updates or maintenance documents reference it.'
                );
        }

        return to_route('maintenance-records.index')
            ->with(
                'message',
                'Successfully deleted a maintenance record.'
            );
    }

    /**
     * Resolve the current authentication identity to its UserAccount.
     *
     * If the authentication model is separate from UserAccount,
     * it must expose a userAccount relationship.
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
     * Take only the MaintenanceRecord fields intended for audit snapshots.
     *
     * @return array<string, mixed>
     */
    private function auditValues(
        MaintenanceRecord $record
    ): array {
        return array_intersect_key(
            $record->getAttributes(),
            array_flip(self::AUDITABLE_FIELDS)
        );
    }

    /**
     * Create an audit log in the same transaction as the record change.
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    private function writeAuditLog(
        UserAccount $actorAccount,
        string $action,
        MaintenanceRecord $record,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $recipient = null;
        $notificationMessage = null;

        /*
         * The documented creation notification is sent to the active
         * UserAccount linked to the assigned Engineer, unless it is
         * the same account that created the record.
         */
        if ($action === 'CREATE') {
            $recipient = UserAccount::query()
                ->where(
                    'engineer_id',
                    $record->managing_engineer_id
                )
                ->where('is_active', true)
                ->first();

            if (
                $recipient !== null
                && (string) $recipient->getKey()
                    === (string) $actorAccount->getKey()
            ) {
                $recipient = null;
            }

            if ($recipient !== null) {
                $notificationMessage = sprintf(
                    'A maintenance record for %s %s has been assigned to you.',
                    $record->maintenance_year,
                    $record->quarter
                );
            }
        }

        $description = match ($action) {
            'CREATE' => "Maintenance record #{$record->getKey()} was created.",
            'UPDATE' => "Maintenance record #{$record->getKey()} was updated.",
            'DELETE' => "Maintenance record #{$record->getKey()} was deleted.",
            default => "Maintenance record #{$record->getKey()} changed.",
        };

        AuditLog::create([
            'user_id' => $actorAccount->getKey(),
            'actor_identifier' => 'UserAccount#'
                .$actorAccount->getKey(),
            'action' => $action,
            'entity_type' => 'MaintenanceRecord',
            'entity_id' => $record->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'recipient_user_id' => $recipient?->getKey(),
            'notification_message' => $notificationMessage,
        ]);
    }
}
