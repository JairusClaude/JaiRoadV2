<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesAndAuditsDirectory;
use App\Services\AccountIdentityResolver;
use App\Services\DashboardAnalytics;
use App\Services\PreservedProjectDeletion;
use App\Services\RoleAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * PHASE 3A: DD-only role access + essential identity/LGU administration.
 * Never uses legacy public business tables; public.users is Fortify infrastructure.
 * All writes use existing, approved DD entities + a system-written AuditLog.
 */
class DirectoryController extends Controller
{
    use AuthorizesAndAuditsDirectory;

    public function show(string $section, Request $request, AccountIdentityResolver $resolver): Response|RedirectResponse
    {
        // The single named DD GET route dispatches to one of the two DD-only
        // controllers. Keep these sections separate from legacy public CRUD.
        if (in_array($section, ['settings', 'roads', 'projects', 'updates', 'documents'], true)) {
            return app(OperationsController::class)->show($section, $request, $resolver);
        }

        $actor = $this->identity($request, $resolver);
        abort_unless(in_array($section, ['dashboard', 'users', 'lgus'], true), 404);
        if ($section === 'dashboard' && $actor['role'] === 'SuperAdmin') {
            return redirect()->route('jairoads.dd-superadmin-landing');
        }
        if ($section === 'lgus') {
            return redirect('/dd-phase3/ui/lgus');
        }
        if ($section === 'users') {
            abort_unless(RoleAccess::canManageAccounts($actor['role']), 403);
        }
        $t = static fn (string $name) => DB::table('jairoads_next.'.$name);
        $lguQuery = $t('lgus')->orderBy('id');
        if ($actor['role'] === 'Engineer') {
            // Engineer visibility is limited to their CURRENT active LGU scope.
            $lguQuery->whereIn('id', $t('engineer_lgus')
                ->where('engineer_id', $actor['engineer_id'])
                ->where('is_active', true)->select('lgu_id'));
        }
        $lgus = $lguQuery->limit(200)->get([
            'id', 'municipality_name', 'province', 'region',
            'mayor_first_name', 'mayor_middle_name', 'mayor_last_name',
        ]);
        $allowedManager = RoleAccess::canManageAccounts($actor['role']);
        $accounts = $allowedManager ? $t('user_accounts')->orderBy('id')->limit(200)->get([
            'id', 'username', 'email', 'account_type', 'engineer_id', 'is_active',
        ]) : collect();
        $engineers = $allowedManager ? $t('engineers')->orderBy('id')->limit(200)->get([
            'id', 'first_name', 'middle_name', 'last_name', 'contact_no', 'rank', 'engineer_status',
        ]) : collect();
        // Do not infer availability from the paginated account directory.
        $eligibleEngineers = $allowedManager ? $t('engineers as e')
            ->where('e.engineer_status', 'Active')
            ->whereNotExists(static fn (Builder $query) => $query->selectRaw('1')
                ->from('jairoads_next.user_accounts as ua')->whereColumn('ua.engineer_id', 'e.id'))
            ->orderBy('e.last_name')->orderBy('e.first_name')->orderBy('e.id')
            ->get(['e.id', 'e.first_name', 'e.last_name', 'e.rank', 'e.engineer_status']) : collect();
        $assignments = $allowedManager ? $t('engineer_lgus')->orderBy('engineer_id')->limit(300)->get([
            'engineer_id', 'lgu_id', 'is_active',
        ]) : collect();
        $counts = [
            'lgus' => $lguQuery->count(),
            'roadCoverages' => $actor['role'] === 'Engineer'
                ? (int) $t('road_coverages')->whereIn('lgu_id', $t('engineer_lgus')->where('engineer_id', $actor['engineer_id'])->where('is_active', true)->select('lgu_id'))->count()
                : (int) $t('road_coverages')->count(),
            'maintenanceProjects' => $allowedManager || $actor['role'] === 'Viewer'
                ? (int) $t('maintenance_projects')->count() : null,
            'userAccounts' => $allowedManager ? (int) $t('user_accounts')->count() : null,
            'maintenanceRecords' => $allowedManager ? (int) $t('maintenance_records')->count() : null,
            'monthlyUpdates' => $allowedManager ? (int) $t('monthly_updates')->count() : null,
            'documents' => $allowedManager ? (int) $t('maintenance_documents')->count() : null,
        ];
        $userName = $t('user_accounts')->where('id', $actor['account_id'])->value('username');

        return Inertia::render('dd-phase3/Workspace', [
            'section' => $section,
            'identity' => ['role' => $actor['role'], 'username' => (string) $userName, 'accountId' => $actor['account_id']],
            'counts' => $counts,
            'historyUrl' => $allowedManager && app(PreservedProjectDeletion::class)->available() ? '/dd-phase3/history/records' : null,
            'analytics' => $section === 'dashboard' ? app(DashboardAnalytics::class)->summary($actor) : null,
            'lgus' => $lgus, 'accounts' => $accounts,
            'engineers' => $engineers,
            'eligibleEngineers' => $eligibleEngineers, 'assignments' => $assignments,
            'canManage' => $allowedManager,
            // Both authorized administrative roles can create standard DD accounts.
            // Initial SuperAdmin creation is a separate owner-verified bootstrap.
            'canCreateRoles' => $allowedManager ? ['Admin', 'Engineer', 'Viewer'] : [],
            'status' => $request->session()->get('dd_phase3_status'),
            'canonicalFrontend' => true,
            'jairoadsIdentity' => ['role' => strtolower($actor['role'])],
            'navigationSection' => $section,
        ]);
    }
}
