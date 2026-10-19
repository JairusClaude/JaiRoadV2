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
 * SuperAdmin Command Center — system-wide, read-only governance overview.
 * This action never changes database records, roles, sessions, or Storage.
 * It is NOT a substitute for policy enforcement on account mutations.
 */
final class SuperAdminDashboardController extends Controller
{
    public function __invoke(Request $request, VerifiedProjectAccount $access): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);
        $account = $access->require($user);
        abort_unless($access->role($user) === 'superadmin', 403);

        $has = static fn (string $table, array $columns = []): bool =>
            Schema::hasTable($table) && ($columns === [] || Schema::hasColumns($table, $columns));

        $accountColumns = ['id', 'username', 'accountType', 'is_active', 'engineers_id'];
        abort_unless($has('user_accounts', $accountColumns), 503, 'UserAccount schema not ready.');

        $byRole = DB::table('user_accounts')
            ->selectRaw('LOWER("accountType") as role, COUNT(*) as total')
            ->groupByRaw('LOWER("accountType")')
            ->pluck('total', 'role');

        $counts = [
            'accounts' => (int) DB::table('user_accounts')->count(),
            'activeAccounts' => (int) DB::table('user_accounts')->where('is_active', true)->count(),
            'inactiveAccounts' => (int) DB::table('user_accounts')->where('is_active', false)->count(),
            'superadmins' => (int) ($byRole['superadmin'] ?? 0),
            'admins' => (int) ($byRole['admin'] ?? 0),
            'engineerAccounts' => (int) ($byRole['engineer'] ?? 0),
            'viewers' => (int) ($byRole['viewer'] ?? 0),
            'unlinkedAdmins' => (int) DB::table('user_accounts')->whereRaw('LOWER("accountType") = ?', ['admin'])
                ->whereNull('engineers_id')->count(),
            'engineers' => $has('engineers', ['id']) ? (int) DB::table('engineers')->count() : null,
            'retiredEngineers' => $has('engineers', ['engineer_status'])
                ? (int) DB::table('engineers')->where('engineer_status', 'Retired')->count() : null,
            'lguAssignments' => $has('engineer_lgus', ['is_active'])
                ? (int) DB::table('engineer_lgus')->count() : null,
            'activeAssignments' => $has('engineer_lgus', ['is_active'])
                ? (int) DB::table('engineer_lgus')->where('is_active', true)->count() : null,
            'projects' => $has('maintenance_projects') ? (int) DB::table('maintenance_projects')->count() : null,
            'roadCoverages' => $has('road_coverages') ? (int) DB::table('road_coverages')->count() : null,
            'maintenanceRecords' => $has('maintenance_records') ? (int) DB::table('maintenance_records')->count() : null,
        ];

        // Full audit access is allowed for both Admin and SuperAdmin by Data Dictionary.
        // This dashboard shows only recent metadata, never secrets or OldValue/NewValue.
        $events = [];
        if ($has('audit_logs', ['id', 'action', 'entity_type', 'actor_identifier', 'created_at'])) {
            $events = DB::table('audit_logs')->orderByDesc('created_at')->orderByDesc('id')
                ->limit(8)->get(['id', 'action', 'entity_type', 'actor_identifier', 'created_at'])
                ->map(static fn ($event): array => [
                    'id' => (int) $event->id,
                    'action' => (string) $event->action,
                    'entity' => (string) $event->entity_type,
                    'actor' => (string) $event->actor_identifier,
                    'createdAt' => (string) $event->created_at,
                ])->all();
        }

        $privilegedAccounts = DB::table('user_accounts')
            ->whereRaw('LOWER("accountType") IN (?, ?)', ['superadmin', 'admin'])
            ->orderBy('id')
            ->limit(30)
            ->get($accountColumns)
            ->map(static fn ($item): array => [
                'id' => (int) $item->id,
                'username' => (string) $item->username,
                'role' => strtolower((string) $item->accountType),
                'active' => (bool) $item->is_active,
                'linkedEngineer' => $item->engineers_id === null ? null : (int) $item->engineers_id,
            ])->all();

        return Inertia::render('SuperAdminDashboard/Index', [
            'username' => (string) $account->username,
            'counts' => $counts,
            'privilegedAccounts' => $privilegedAccounts,
            'recentEvents' => $events,
            // Deliberate scope: existing authorized provisioning supports Admin creation,
            // but role transitions, deactivations and configurable MFA require later
            // policies and server workflows; do not advertise these as working controls.
            'supportedActions' => ['createAdmin' => true, 'roleChange' => false,
                'adminDeactivation' => false, 'securityPolicyEditing' => false],
        ]);
    }
}
