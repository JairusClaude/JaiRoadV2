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
    private const AUDITABLE_FIELDS = [
        'maintenance_projects_id',
        'engineers_id',
        'maintenance_year',
        'quarter',
        'start_date',
        'estimated_duration_days',
        'complete_date',
        'status',
        'description',
        'created_by',
    ];

    public function index(): Response
    {
        Gate::authorize('viewAny', MaintenanceRecord::class);

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

        return Inertia::render('MaintenanceRecords/Index', [
            'model' => $model,
            'maintenanceProjects' => MaintenanceProject::query()
                ->orderBy('project_title')
                ->get(['id', 'project_title']),
            'engineers' => Engineer::query()
                ->orderBy('last_name')
                ->get([
                    'id',
                    'first_name',
                    'middle_name',
                    'last_name',
                ]),
            'userAccounts' => UserAccount::query()
                ->orderBy('username')
                ->get(['id', 'username']),
            'queryParams' => request()->query(),
        ]);
    }

    public function store(
        StoreMaintenanceRecordRequest $request
    ): RedirectResponse {
        Gate::authorize('create', MaintenanceRecord::class);

        $data = $request->validated();

        DB::transaction(function () use ($data): void {
            $record = MaintenanceRecord::create($data);

            $this->writeAuditLog(
                'created',
                $record,
                null,
                $record->only(self::AUDITABLE_FIELDS)
            );
        });

        return to_route('maintenance-records.index')
            ->with(
                'message',
                'Successfully created a maintenance record'
            );
    }

    public function update(
        UpdateMaintenanceRecordRequest $request,
        MaintenanceRecord $maintenanceRecord
    ): RedirectResponse {
        Gate::authorize('update', $maintenanceRecord);

        $data = $request->validated();
        $oldValues = $maintenanceRecord->only(
            self::AUDITABLE_FIELDS
        );

        DB::transaction(function () use (
            $data,
            $maintenanceRecord,
            $oldValues
        ): void {
            $maintenanceRecord->update($data);

            $this->writeAuditLog(
                'updated',
                $maintenanceRecord,
                $oldValues,
                $maintenanceRecord->only(self::AUDITABLE_FIELDS)
            );
        });

        return to_route(
            'maintenance-records.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated a maintenance record'
        );
    }

    public function destroy(
        MaintenanceRecord $maintenanceRecord
    ): RedirectResponse {
        Gate::authorize('delete', $maintenanceRecord);

        $oldValues = $maintenanceRecord->only(
            self::AUDITABLE_FIELDS
        );

        DB::transaction(function () use (
            $maintenanceRecord,
            $oldValues
        ): void {
            $maintenanceRecord->delete();

            $this->writeAuditLog(
                'deleted',
                $maintenanceRecord,
                $oldValues,
                null
            );
        });

        return to_route('maintenance-records.index')
            ->with(
                'message',
                'Successfully deleted a maintenance record'
            );
    }

    private function writeAuditLog(
        string $action,
        MaintenanceRecord $record,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $actor = Auth::user();

        AuditLog::create([
            'actor_identifier' => $actor === null
                ? 'system'
                : 'users:'.$actor->getAuthIdentifier(),
            'action' => $action,
            'entity_type' => MaintenanceRecord::class,
            'entity_id' => $record->getKey(),
            'description' => "Maintenance record #{$record->getKey()} was {$action}.",
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'notification_message' => "Maintenance record #{$record->getKey()} {$action}.",
            'user_id' => null,
            'recipient_user_id' => null,
        ]);
    }
}
