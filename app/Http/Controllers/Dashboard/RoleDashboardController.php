<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Final JaiROADS Data Dictionary: read-only, role-appropriate landing dashboard.
 * Never grants permissions: policies/controllers must enforce every operational write.
 */
final class RoleDashboardController extends Controller
{
    public function __invoke(Request $request, VerifiedProjectAccount $access): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $account = $access->require($user);
        $role = $access->role($user);
        abort_unless(in_array($role, ['engineer', 'viewer'], true), 403);

        $has = static fn (string $table, array $columns = []): bool => Schema::hasTable($table) && ($columns === [] || Schema::hasColumns($table, $columns));

        $assignedLgus = [];
        $recentRecords = [];
        $notifications = [];
        $stats = [
            'assignedLgus' => 0,
            'managedRecords' => 0,
            'ongoingRecords' => 0,
            'roadCoverages' => null,
            'projects' => null,
            'lgus' => null,
        ];
        $engineer = null;
        $limitedAccess = false;

        if ($role === 'engineer') {
            // The final dictionary requires a linked Active Engineer profile.
            abort_unless($account->engineers_id !== null && $account->engineers_id > 0, 403);
            abort_unless($has('engineers', ['id', 'first_name', 'last_name', 'engineer_status']), 503);
            $profile = DB::table('engineers')->where('id', $account->engineers_id)
                ->first(['id', 'first_name', 'middle_name', 'last_name', 'rank', 'engineer_status']);
            abort_unless($profile && $profile->engineer_status === 'Active', 403);

            $engineer = [
                'id' => (int) $profile->id,
                'name' => trim(implode(' ', array_filter([
                    (string) $profile->first_name,
                    (string) ($profile->middle_name ?? ''),
                    (string) $profile->last_name,
                ]))),
                'rank' => (string) ($profile->rank ?? ''),
                'status' => (string) $profile->engineer_status,
            ];

            if ($has('engineer_lgus', ['engineers_id', 'lgus_id', 'is_active'])
                && $has('lgus', ['id', 'municipality_name'])) {
                $assignedLgus = DB::table('engineer_lgus as el')
                    ->join('lgus as l', 'l.id', '=', 'el.lgus_id')
                    ->where('el.engineers_id', $profile->id)
                    ->where('el.is_active', true)
                    ->orderBy('l.municipality_name')
                    ->get(['l.id', 'l.municipality_name'])
                    ->map(static fn ($lgu): array => [
                        'id' => (int) $lgu->id,
                        'name' => (string) $lgu->municipality_name,
                    ])->all();
            }

            $activeLguIds = array_column($assignedLgus, 'id');
            $stats['assignedLgus'] = count($activeLguIds);
            $limitedAccess = $activeLguIds === [];

            if ($has('road_coverages', ['id', 'lgu_id'])) {
                $stats['roadCoverages'] = $activeLguIds === [] ? 0
                    : (int) DB::table('road_coverages')->whereIn('lgu_id', $activeLguIds)->count();
            }

            // ManagingEngineerID is maintenance_records.engineers_id in the deployed schema.
            // Count own historical records even when the LGU assignment is inactive;
            // lack of an active LGU explicitly means NO operational write access.
            if ($has('maintenance_records', ['id', 'engineers_id', 'status', 'maintenance_projects_id', 'maintenance_year', 'quarter'])
                && $has('maintenance_projects', ['id', 'project_title', 'road_coverage_id'])
                && $has('road_coverages', ['id', 'lgu_id'])) {
                $owned = DB::table('maintenance_records as mr')
                    ->leftJoin('maintenance_projects as mp', 'mp.id', '=', 'mr.maintenance_projects_id')
                    ->leftJoin('road_coverages as rc', 'rc.id', '=', 'mp.road_coverage_id')
                    ->where('mr.engineers_id', $profile->id);
                $stats['managedRecords'] = (clone $owned)->count();
                $stats['ongoingRecords'] = (clone $owned)->where('mr.status', 'Ongoing')->count();
                $recentRecords = $owned->orderByDesc('mr.id')->limit(6)
                    ->get(['mr.id', 'mr.maintenance_year', 'mr.quarter', 'mr.status',
                        'mp.id as project_id', 'mp.project_title', 'rc.lgu_id'])
                    ->map(static fn ($record): array => [
                        'id' => (int) $record->id,
                        'projectId' => $record->project_id === null ? null : (int) $record->project_id,
                        'projectTitle' => (string) ($record->project_title ?? 'Unlinked project'),
                        'period' => (string) $record->maintenance_year.' · '.(string) $record->quarter,
                        'status' => (string) $record->status,
                        // Informational only. Actual edit permission is server-enforced.
                        'inActiveLgu' => $record->lgu_id !== null
                            && in_array((int) $record->lgu_id, $activeLguIds, true),
                    ])->all();
            }
        } else {
            // Viewer: system-wide read-only overview; no account, audit or private user statistics.
            if ($has('maintenance_projects')) {
                $stats['projects'] = (int) DB::table('maintenance_projects')->count();
            }
            if ($has('road_coverages')) {
                $stats['roadCoverages'] = (int) DB::table('road_coverages')->count();
            }
            if ($has('lgus')) {
                $stats['lgus'] = (int) DB::table('lgus')->count();
            }
            if ($has('maintenance_records', ['id', 'status'])) {
                $stats['managedRecords'] = (int) DB::table('maintenance_records')->count();
                $stats['ongoingRecords'] = (int) DB::table('maintenance_records')
                    ->where('status', 'Ongoing')->count();
            }
            if ($has('maintenance_projects', ['id', 'project_title'])) {
                $recentRecords = DB::table('maintenance_projects')->orderByDesc('id')
                    ->limit(6)->get(['id', 'project_title'])
                    ->map(static fn ($project): array => [
                        'id' => (int) $project->id,
                        'projectId' => (int) $project->id,
                        'projectTitle' => (string) $project->project_title,
                        'period' => '',
                        'status' => '',
                        'inActiveLgu' => false,
                    ])->all();
            }
        }

        // Notifications come from AuditLog, never from a new Notifications entity.
        // Strictly RecipientUserID-scoped and three exposed fields only.
        if ($has('audit_logs', ['id', 'recipient_user_id', 'notification_message', 'created_at'])) {
            $notifications = DB::table('audit_logs')
                ->where('recipient_user_id', $account->id)
                ->whereNotNull('notification_message')
                ->whereRaw("btrim(notification_message) <> ''")
                ->orderByDesc('created_at')->orderByDesc('id')
                ->limit(8)->get(['id', 'notification_message', 'created_at'])
                ->map(static fn ($notice): array => [
                    'id' => (int) $notice->id,
                    'message' => (string) $notice->notification_message,
                    'createdAt' => (string) $notice->created_at,
                ])->all();
        }

        return Inertia::render('RoleDashboard/Index', [
            'role' => $role,
            'name' => (string) $user->name,
            'username' => (string) $account->username,
            'engineer' => $engineer,
            'assignedLgus' => $assignedLgus,
            'stats' => $stats,
            'records' => $recentRecords,
            'limitedAccess' => $limitedAccess,
            'notifications' => $notifications,
        ]);
    }
}
