<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdDashboardAnalytics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Original JaiROADS Engineer/Viewer dashboard design, backed exclusively by
 * the 11 approved jairoads_next business entities.  No public business reads.
 */
final class DdRoleDashboardController extends Controller
{
    public function show(Request $request, DataDictionaryIdentityResolver $resolver): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('dd_user_account_id') !== null, 403);
        $actor = $resolver->resolve($user);
        abort_unless($actor !== null && in_array($actor['role'], ['Engineer', 'Viewer'], true), 403);

        $engineer = null;
        $assigned = [];
        $records = [];
        $stats = [
            'assignedLgus' => 0, 'managedRecords' => 0, 'ongoingRecords' => 0,
            'roadCoverages' => 0, 'projects' => 0, 'lgus' => 0,
        ];

        // An unlinked Engineer is allowed to sign in but has no EngineerLGU
        // assignment or maintenance editing privileges. Never cast NULL to 0.
        if ($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null) {
            $id = (int) $actor['engineer_id'];
            $profile = DB::table('jairoads_next.engineers')->where('id', $id)
                ->where('engineer_status', 'Active')
                ->first(['id', 'first_name', 'middle_name', 'last_name', 'rank', 'engineer_status']);
            abort_unless($profile !== null, 403);
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
            $assigned = DB::table('jairoads_next.engineer_lgus as x')
                ->join('jairoads_next.lgus as l', 'l.id', '=', 'x.lgu_id')
                ->where('x.engineer_id', $id)->where('x.is_active', true)
                ->orderBy('l.municipality_name')->get(['l.id', 'l.municipality_name'])
                ->map(static fn ($l): array => ['id' => (int) $l->id, 'name' => (string) $l->municipality_name])->all();
            $lguIds = array_column($assigned, 'id');
            $stats['assignedLgus'] = count($lguIds);
            $stats['roadCoverages'] = $lguIds === [] ? 0 : (int) DB::table('jairoads_next.road_coverages')
                ->whereIn('lgu_id', $lguIds)->count();

            // Read only records in current active LGU scope, managed by this Engineer.
            $scope = DB::table('jairoads_next.maintenance_records as mr')
                ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
                ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
                ->where('mr.managing_engineer_id', $id)
                ->whereIn('rc.lgu_id', $lguIds);
            $stats['managedRecords'] = (clone $scope)->count();
            $stats['ongoingRecords'] = (clone $scope)->where('mr.status', 'Ongoing')->count();
            $records = $scope->orderByDesc('mr.id')->limit(6)
                ->get(['mr.id', 'mr.project_id', 'mr.maintenance_year', 'mr.quarter', 'mr.status', 'p.project_title', 'rc.lgu_id'])
                ->map(static fn ($r): array => [
                    'id' => (int) $r->id, 'projectId' => (int) $r->project_id,
                    'projectTitle' => (string) $r->project_title,
                    'period' => (string) $r->maintenance_year.' · '.(string) $r->quarter,
                    'status' => (string) $r->status, 'inActiveLgu' => true,
                ])->all();
        } elseif ($actor['role'] === 'Viewer') {
            $stats['projects'] = (int) DB::table('jairoads_next.maintenance_projects')->count();
            $stats['managedRecords'] = (int) DB::table('jairoads_next.maintenance_records')->count();
            $stats['ongoingRecords'] = (int) DB::table('jairoads_next.maintenance_records')
                ->where('status', 'Ongoing')->count();
            $stats['roadCoverages'] = (int) DB::table('jairoads_next.road_coverages')->count();
            $stats['lgus'] = (int) DB::table('jairoads_next.lgus')->count();
            $records = DB::table('jairoads_next.maintenance_projects')->orderByDesc('id')
                ->limit(6)->get(['id', 'project_title'])
                ->map(static fn ($p): array => [
                    'id' => (int) $p->id, 'projectId' => (int) $p->id, 'projectTitle' => (string) $p->project_title,
                    'period' => '', 'status' => '', 'inActiveLgu' => false,
                ])->all();
        }

        $notifications = DB::table('jairoads_next.audit_logs')
            ->where('recipient_user_id', $actor['account_id'])
            ->whereNotNull('notification_message')
            ->orderByDesc('created_at')->orderByDesc('id')->limit(8)
            ->get(['id', 'notification_message', 'created_at'])
            ->map(static fn ($n): array => [
                'id' => (int) $n->id, 'message' => (string) $n->notification_message,
                'createdAt' => (string) $n->created_at,
            ])->all();

        $username = DB::table('jairoads_next.user_accounts')
            ->where('id', $actor['account_id'])->value('username');

        return Inertia::render('dd-phase3/RoleDashboard', [
            'role' => strtolower($actor['role']),
            'name' => (string) $user->name,
            'username' => (string) $username,
            'engineer' => $engineer,
            'assignedLgus' => $assigned,
            'limitedAccess' => $actor['role'] === 'Engineer' && $assigned === [],
            'stats' => $stats,
            'analytics' => app(DdDashboardAnalytics::class)->summary($actor),
            'records' => $records,
            'notifications' => $notifications,
        ]);
    }
}
