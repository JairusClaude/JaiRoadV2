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
        $lgus = $lguQuery->limit(200)->get([
            'id', 'municipality_name', 'province', 'region',
            'mayor_first_name', 'mayor_middle_name', 'mayor_last_name',
        ]);
        $allowedManager = RoleAccess::canManageAccounts($actor['role']);
        $accounts = collect();
        $engineers = collect();
        $directory = null;
        $requestedEngineerId = $section === 'users' && $allowedManager ? $request->integer('engineer_id') : 0;
        if ($section === 'users' && $allowedManager) {
            // Search and paginate in PostgreSQL instead of filtering only the
            // first 200 records. Related names are loaded for the visible rows.
            $tab = $requestedEngineerId > 0 || $request->query('directory_tab') === 'engineers' ? 'engineers' : 'accounts';
            $inputSearch = $request->query('directory_search');
            $search = is_string($inputSearch) ? mb_substr(trim($inputSearch), 0, 150) : '';
            $roleInput = $request->query('directory_role');
            $role = is_string($roleInput) && in_array($roleInput, ['SuperAdmin', 'Admin', 'Engineer', 'Viewer'], true) ? $roleInput : 'all';
            $state = in_array($request->query('directory_state'), ['active', 'inactive'], true) ? $request->query('directory_state') : 'all';
            // Escape PostgreSQL LIKE wildcards and the escape character. A search is
            // literal text, never a caller-controlled pattern.
            $needle = '%'.addcslashes($search, '%_\\').'%';
            $requestedPage = filter_var($request->query('directory_page'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($tab === 'accounts') {
                $query = $t('user_accounts as ua')->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'ua.engineer_id');
                if ($search !== '') {
                    $query->where(static fn (Builder $q) => $q->where('ua.username', 'ilike', $needle)
                        ->orWhere('ua.email', 'ilike', $needle)->orWhere('ua.account_type', 'ilike', $needle)
                        ->orWhereRaw('CAST(ua.id AS text) ILIKE ?', [$needle])
                        ->orWhereRaw("CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) ILIKE ?", [$needle]));
                }
                if ($role !== 'all') {
                    $query->where('ua.account_type', $role);
                }
                if ($state !== 'all') {
                    $query->where('ua.is_active', $state === 'active');
                }
                // Clamp out-of-range pages before querying, including after
                // a search or filter reduces the number of matches.
                $lastPage = max(1, (int) ceil((clone $query)->count() / 15));
                $pageNumber = min($requestedPage === false ? 1 : $requestedPage, $lastPage);
                $page = $query->orderByDesc('ua.id')->paginate(15, ['ua.id', 'ua.username', 'ua.email', 'ua.account_type', 'ua.engineer_id', 'ua.is_active'], 'directory_page', $pageNumber);
                $accounts = collect($page->items());
                $engineers = $t('engineers')->whereIn('id', $accounts->pluck('engineer_id')->filter()->all())
                    ->get(['id', 'first_name', 'middle_name', 'last_name', 'contact_no', 'rank', 'engineer_status']);
            } else {
                $query = $t('engineers as e');
                if ($search !== '') {
                    $query->where(static fn (Builder $q) => $q->whereRaw("CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) ILIKE ?", [$needle])
                        ->orWhere('e.rank', 'ilike', $needle)->orWhere('e.contact_no', 'ilike', $needle)
                        ->orWhereRaw('CAST(e.id AS text) ILIKE ?', [$needle])
                        ->orWhereExists(static fn (Builder $linked) => $linked->selectRaw('1')->from('jairoads_next.user_accounts as ua')
                            ->whereColumn('ua.engineer_id', 'e.id')->where('ua.username', 'ilike', $needle)));
                }
                if ($state !== 'all') {
                    $query->where('e.engineer_status', $state === 'active' ? '=' : '!=', 'Active');
                }
                if ($requestedEngineerId > 0) {
                    $query->orderByRaw('CASE WHEN e.id = ? THEN 0 ELSE 1 END', [$requestedEngineerId]);
                }
                $lastPage = max(1, (int) ceil((clone $query)->count() / 15));
                $pageNumber = min($requestedPage === false ? 1 : $requestedPage, $lastPage);
                $page = $query->orderByDesc('e.id')->paginate(15, ['e.id', 'e.first_name', 'e.middle_name', 'e.last_name', 'e.contact_no', 'e.rank', 'e.engineer_status'], 'directory_page', $pageNumber);
                $engineers = collect($page->items());
                $accounts = $t('user_accounts')->whereIn('engineer_id', $engineers->pluck('id')->all())
                    ->get(['id', 'username', 'email', 'account_type', 'engineer_id', 'is_active']);
            }
            $directory = [
                'tab' => $tab, 'search' => $search, 'role' => $role, 'state' => $state,
                'page' => $page->currentPage(), 'pages' => $page->lastPage(), 'total' => $page->total(),
                'accountTotal' => (int) $t('user_accounts')->count(),
                'activeAccounts' => (int) $t('user_accounts')->where('is_active', true)->count(),
                'engineerTotal' => (int) $t('engineers')->count(),
                'activeEngineers' => (int) $t('engineers')->where('engineer_status', 'Active')->count(),
            ];
        }
        // A direct profile link is still honored, even if there are many engineers.
        $initialEngineerId = $requestedEngineerId > 0 && $engineers->contains('id', $requestedEngineerId)
            ? $requestedEngineerId : null;
        // Do not infer availability from the paginated account directory.
        $eligibleEngineers = $allowedManager ? $t('engineers as e')
            ->where('e.engineer_status', 'Active')
            ->whereNotExists(static fn (Builder $query) => $query->selectRaw('1')
                ->from('jairoads_next.user_accounts as ua')->whereColumn('ua.engineer_id', 'e.id'))
            ->orderBy('e.last_name')->orderBy('e.first_name')->orderBy('e.id')
            ->get(['e.id', 'e.first_name', 'e.last_name', 'e.rank', 'e.engineer_status']) : collect();
        $counts = [
            'lgus' => $lguQuery->count(),
            'roadCoverages' => (int) $t('road_coverages')->count(),
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
            'initialEngineerId' => $initialEngineerId, 'directory' => $directory,
            'eligibleEngineers' => $eligibleEngineers, 'assignments' => [],
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
