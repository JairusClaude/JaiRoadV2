<?php

declare(strict_types=1);

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\DataDictionary\StagingUserAccount;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdDashboardAnalytics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * DD SuperAdmin Command Center — original JaiROADS command-center presentation,
 * backed ONLY by the approved 11 jairoads_next entities.
 * No legacy business CRUD or account mutations are authorized by this endpoint.
 */
final class DdSuperAdminLandingController extends Controller
{
    public function __invoke(Request $request, DataDictionaryIdentityResolver $identities): Response
    {
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $identity = $identities->resolve($login);
        abort_unless($identity !== null && $identity['role'] === 'SuperAdmin', 403);

        $account = StagingUserAccount::query()->whereKey($identity['account_id'])->first();
        abort_unless($account !== null && $account->is_active, 403);

        // All business reads are explicitly schema-qualified; the default
        // public search_path must remain intact for Fortify/session tables.
        $table = static fn (string $name) => DB::table('jairoads_next.'.$name);

        $roleCounts = $table('user_accounts')
            ->select('account_type')
            ->selectRaw('COUNT(*) AS total')
            ->groupBy('account_type')
            ->pluck('total', 'account_type');

        $counts = [
            'accounts' => (int) $table('user_accounts')->count(),
            'activeAccounts' => (int) $table('user_accounts')->where('is_active', true)->count(),
            'inactiveAccounts' => (int) $table('user_accounts')->where('is_active', false)->count(),
            'superadmins' => (int) ($roleCounts['SuperAdmin'] ?? 0),
            'admins' => (int) ($roleCounts['Admin'] ?? 0),
            'engineerAccounts' => (int) ($roleCounts['Engineer'] ?? 0),
            'viewers' => (int) ($roleCounts['Viewer'] ?? 0),
            'unlinkedAdmins' => (int) $table('user_accounts')
                ->where('account_type', 'Admin')->whereNull('engineer_id')->count(),
            'engineers' => (int) $table('engineers')->count(),
            'retiredEngineers' => (int) $table('engineers')
                ->where('engineer_status', 'Retired')->count(),
            'lguAssignments' => (int) $table('engineer_lgus')->count(),
            'activeAssignments' => (int) $table('engineer_lgus')
                ->where('is_active', true)->count(),
            'lgus' => (int) $table('lgus')->count(),
            'projects' => (int) $table('maintenance_projects')->count(),
            'roadCoverages' => (int) $table('road_coverages')->count(),
            'maintenanceRecords' => (int) $table('maintenance_records')->count(),
            'monthlyUpdates' => (int) $table('monthly_updates')->count(),
            'documents' => (int) $table('maintenance_documents')->count(),
            'media' => (int) $table('media')->count(),
            'auditEvents' => (int) $table('audit_logs')->count(),
        ];

        // Never return DD hashed credentials or AuditLog old_value/new_value.
        $privilegedAccounts = $table('user_accounts')
            ->whereIn('account_type', ['SuperAdmin', 'Admin'])
            ->orderBy('id')->limit(30)
            ->get(['id', 'username', 'account_type', 'engineer_id', 'is_active'])
            ->map(static fn ($row): array => [
                'id' => (int) $row->id,
                'username' => (string) $row->username,
                'role' => (string) $row->account_type,
                'active' => (bool) $row->is_active,
                'linkedEngineer' => $row->engineer_id === null ? null : (int) $row->engineer_id,
            ])->all();

        $recentEvents = $table('audit_logs')
            ->orderByDesc('created_at')->orderByDesc('id')->limit(8)
            ->get(['id', 'action', 'entity_type', 'actor_identifier', 'created_at'])
            ->map(static fn ($row): array => [
                'id' => (int) $row->id,
                'action' => (string) $row->action,
                'entity' => (string) $row->entity_type,
                'actor' => (string) $row->actor_identifier,
                'createdAt' => (string) $row->created_at,
            ])->all();

        return Inertia::render('dd-superadmin-command-center/Index', [
            'username' => (string) $account->username,
            'counts' => $counts,
            'analytics' => app(DdDashboardAnalytics::class)->summary($identity),
            'privilegedAccounts' => $privilegedAccounts,
            'recentEvents' => $recentEvents,
            // Do not advertise unaudited / unmigrated operations as enabled.
            'supportedActions' => [
                'createAdmin' => false,
                'roleChange' => false,
                'adminDeactivation' => false,
                'securityPolicyEditing' => false,
            ],
        ]);
    }
}
