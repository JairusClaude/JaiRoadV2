<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MaintenanceRecord;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Phase B2 read-only entry point. No mutation routes are exposed.
 * Unlike the legacy index action, this never returns global Engineer/Project
 * selection lists to Engineer accounts.
 */
final class MaintenanceRecordReadOnlyController extends Controller
{
    public function index(Request $request, VerifiedProjectAccount $accounts): Response
    {
        Gate::authorize('viewAny', MaintenanceRecord::class);

        $user = $request->user();
        abort_unless($user instanceof User, 403);
        $account = $accounts->require($user);
        $role = $accounts->role($user);
        abort_unless($role !== null, 403);

        $query = MaintenanceRecord::query()
            ->select([
                'id', 'maintenance_projects_id', 'engineers_id',
                'maintenance_year', 'quarter', 'status',
                'start_date', 'complete_date', 'estimated_duration_days',
                'description', 'created_at',
            ])
            ->with([
                'maintenanceProject:id,project_title',
                'managingEngineer:id,first_name,middle_name,last_name',
            ]);

        if (! Gate::allows('viewAll', MaintenanceRecord::class)) {
            // A non-global role must be a linked Engineer with an active LGU
            // assignment, and the record must be managed by that Engineer.
            if ($role !== 'engineer' || ! $account->engineers_id) {
                $query->whereRaw('1 = 0');
            } else {
                $engineerId = (int) $account->engineers_id;
                $query->where('engineers_id', $engineerId)
                    ->whereHas('maintenanceProject.roadCoverage', function (Builder $coverage) use ($engineerId): void {
                        $coverage->whereIn('lgu_id', DB::table('engineer_lgus')
                            ->select('lgus_id')
                            ->where('engineers_id', $engineerId)
                            ->where('is_active', true));
                    });
            }
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $search = mb_substr($search, 0, 120);
            $query->where(function (Builder $records) use ($search): void {
                $like = '%'.$search.'%';
                $records->where('quarter', 'ilike', $like)
                    ->orWhere('status', 'ilike', $like)
                    ->orWhereHas('maintenanceProject', fn (Builder $project) => $project->where('project_title', 'ilike', $like));
                if (ctype_digit($search)) {
                    $records->orWhere('maintenance_year', (int) $search);
                }
            });
        }

        return Inertia::render('MaintenanceRecords/Index', [
            'model' => $query->orderByDesc('id')->paginate(10)->withQueryString(),
            'queryParams' => ['search' => $search],
        ]);
    }
}
