<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MaintenanceRecord;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Minimal prerequisite to attach documents; use the deployed FK names. */
class MaintenanceRecordQuickCreateController extends Controller
{
    public function store(Request $request, VerifiedProjectAccount $accounts): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $account = $accounts->require($user);
        Gate::authorize('create', MaintenanceRecord::class);
        // Engineer creation remains blocked by MaintenanceRecordPolicy until EngineerLGU exists.

        $data = $request->validate([
            'maintenance_projects_id' => ['required', 'integer', 'exists:maintenance_projects,id'],
            'engineers_id' => ['required', 'integer', 'exists:engineers,id'],
            'maintenance_year' => ['required', 'integer', 'between:2000,2100'],
            'quarter' => ['required', Rule::in(['Q1', 'Q2', 'Q3', 'Q4'])],
            'start_date' => ['required', 'date'],
            'estimated_duration_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'status' => ['required', Rule::in(['Ongoing', 'Completed'])],
            'complete_date' => ['nullable', 'required_if:status,Completed', 'date', 'after_or_equal:start_date'],
            'description' => ['nullable', 'string', 'max:5000'],
        ]);
        if ($data['status'] === 'Ongoing') {
            $data['complete_date'] = null;
        }

        DB::transaction(function () use ($account, $data): void {
            $now = now();
            $record = DB::table('maintenance_records')->insertGetId([
                ...$data,
                'created_by' => $account->getKey(),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('audit_logs')->insert([
                'user_id' => $account->getKey(),
                'actor_identifier' => (string) $account->username,
                'action' => 'CREATE',
                'entity_type' => 'MaintenanceRecord',
                'entity_id' => $record,
                'description' => 'Created a maintenance record.',
                'old_value' => null,
                'new_value' => json_encode([
                    'id' => $record,
                    'maintenance_projects_id' => $data['maintenance_projects_id'],
                    'engineers_id' => $data['engineers_id'],
                    'maintenance_year' => $data['maintenance_year'],
                    'quarter' => $data['quarter'],
                    'status' => $data['status'],
                ], JSON_THROW_ON_ERROR),
                'recipient_user_id' => null,
                'notification_message' => '',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });

        return to_route('project-documents.preview')->with('message', 'Maintenance Record created. You can now upload a document.');
    }
}
