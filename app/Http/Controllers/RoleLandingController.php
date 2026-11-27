<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\ActivityNotifications;
use App\Services\DashboardAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Original JaiROADS Engineer/Viewer dashboard design, backed exclusively by
 * the 11 approved jairoads_next business entities.  No public business reads.
 */
final class RoleLandingController extends Controller
{
    /** Read-only, on-demand road summary for Engineer and Viewer. */
    public function roadDetails(Request $request, AccountIdentityResolver $resolver, int $road): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('canonical_user_account_id') !== null, 403);
        $actor = $resolver->resolve($user);
        abort_unless($actor !== null && ($actor['role'] === 'Viewer' || ($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null)), 403);

        // Same cross-municipality read access as the canonical road/project pages.
        $coverage = DB::table('jairoads_next.road_coverages as rc')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id')
            ->where('rc.id', $road)
            ->first(['rc.id', 'rc.road_name', 'rc.kilometers', 'rc.pavement_type', 'rc.state_category',
                'l.municipality_name', 'p.id as project_id', 'p.project_title', 'p.created_by as project_creator']);
        abort_unless($coverage !== null, 404);

        $project = null;
        if ($coverage->project_id !== null) {
            $projectId = (int) $coverage->project_id;
            $records = DB::table('jairoads_next.maintenance_records as m')->where('m.project_id', $projectId);
            $updates = DB::table('jairoads_next.monthly_updates as u')
                ->join('jairoads_next.maintenance_records as m', 'm.id', '=', 'u.maintenance_id')
                ->where('m.project_id', $projectId);
            $documents = DB::table('jairoads_next.maintenance_documents as d')
                ->join('jairoads_next.maintenance_records as m', 'm.id', '=', 'd.maintenance_id')
                ->where('m.project_id', $projectId);
            $latestUpdate = (clone $updates)->orderByDesc('u.update_month')->orderByDesc('u.id')
                ->first(['u.id', 'u.update_month', 'u.progress_percentage']);
            $latestDocument = (clone $documents)->orderByDesc('d.uploaded_at')->orderByDesc('d.id')
                ->first(['d.id', 'd.document_title', 'd.uploaded_at']);
            $createdByMe = $actor['role'] === 'Engineer' && (int) $coverage->project_creator === $actor['account_id'];
            $myRecordCount = $actor['role'] === 'Engineer' ? (clone $records)->where('m.managing_engineer_id', $actor['engineer_id'])->count() : 0;
            $project = [
                'id' => $projectId,
                'title' => $coverage->project_title,
                'my_project' => $createdByMe || $myRecordCount > 0,
                'created_by_me' => $createdByMe,
                'assigned_to_me' => $myRecordCount > 0,
                'my_record_count' => $myRecordCount,
                'record_count' => (clone $records)->count(),
                'recent_records' => (clone $records)
                    ->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'm.managing_engineer_id')
                    ->orderByDesc('m.maintenance_year')->orderByDesc('m.quarter')->orderByDesc('m.id')
                    ->limit(3)->get(['m.id', 'm.maintenance_year', 'm.quarter', 'm.status', 'e.first_name', 'e.last_name'])
                    ->map(static fn ($record): array => [
                        'id' => (int) $record->id,
                        'year' => (int) $record->maintenance_year,
                        'quarter' => $record->quarter,
                        'status' => $record->status,
                        'engineer' => trim(($record->first_name ?? '').' '.($record->last_name ?? '')),
                    ])->all(),
                'update_count' => (clone $updates)->count(),
                'latest_update' => $latestUpdate === null ? null : [
                    'id' => (int) $latestUpdate->id, 'month' => $latestUpdate->update_month,
                    'progress' => (float) $latestUpdate->progress_percentage,
                ],
                'document_count' => (clone $documents)->count(),
                'latest_document' => $latestDocument === null ? null : [
                    'id' => (int) $latestDocument->id, 'title' => $latestDocument->document_title,
                ],
            ];
        }

        // No private storage paths or download URLs are sent to the dashboard.
        return response()->json([
            'id' => (int) $coverage->id, 'name' => $coverage->road_name,
            'municipality' => $coverage->municipality_name,
            'kilometers' => $coverage->kilometers, 'pavement_type' => $coverage->pavement_type,
            'condition' => $coverage->state_category, 'project' => $project,
        ])->header('Cache-Control', 'private, no-store');
    }

    /** Read-only continuation endpoint for the Engineer dashboard map. */
    public function roadMapPage(Request $request, AccountIdentityResolver $resolver): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('canonical_user_account_id') !== null, 403);
        $actor = $resolver->resolve($user);
        abort_unless($actor !== null && $actor['role'] === 'Engineer' && $actor['engineer_id'] !== null, 403);
        $validated = $request->validate(['before' => ['sometimes', 'integer', 'min:1']]);

        return response()->json($this->roadMapBatch($actor, isset($validated['before']) ? (int) $validated['before'] : null))
            ->header('Cache-Control', 'private, no-store');
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array{data:list<array<string,mixed>>,next_cursor:?int}
     */
    private function roadMapBatch(array $actor, ?int $before = null): array
    {
        $engineerId = $actor['role'] === 'Engineer' ? $actor['engineer_id'] : null;
        $accountId = $actor['role'] === 'Engineer' ? $actor['account_id'] : null;
        $query = DB::table('jairoads_next.road_coverages as rc')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id')
            ->select(['rc.id', 'rc.road_name', 'rc.geojson', 'rc.state_category', 'l.municipality_name', 'p.id as project_id', 'p.project_title', 'p.created_by as project_creator'])
            ->selectSub(DB::table('jairoads_next.maintenance_records as mr')
                ->selectRaw('count(*)')->whereColumn('mr.project_id', 'p.id')
                ->whereNotNull('mr.managing_engineer_id')->where('mr.managing_engineer_id', $engineerId), 'my_record_count');
        if ($before !== null) {
            $query->where('rc.id', '<', $before);
        }
        $rows = $query->orderByDesc('rc.id')->limit(101)->get();
        $page = $rows->take(100);

        return [
            'data' => array_values($page->map(static fn (\stdClass $road): array => [
                'id' => (int) $road->id,
                'road_name' => (string) $road->road_name,
                'state_category' => (string) $road->state_category,
                'municipality' => (string) $road->municipality_name,
                'geojson' => json_decode((string) $road->geojson, true, 512, JSON_THROW_ON_ERROR),
                'assigned' => $road->project_id !== null,
                'project_id' => $road->project_id === null ? null : (int) $road->project_id,
                'project_title' => $road->project_title,
                'my_project' => ($accountId !== null && (int) $road->project_creator === $accountId) || (int) $road->my_record_count > 0,
                'created_by_me' => $accountId !== null && (int) $road->project_creator === $accountId,
                'assigned_to_me' => (int) $road->my_record_count > 0,
                'my_record_count' => (int) $road->my_record_count,
            ])->values()->all()),
            'next_cursor' => $rows->count() > 100 ? (int) $page->last()->id : null,
        ];
    }

    public function show(Request $request, AccountIdentityResolver $resolver): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('canonical_user_account_id') !== null, 403);
        $actor = $resolver->resolve($user);
        abort_unless($actor !== null && in_array($actor['role'], ['Engineer', 'Viewer'], true), 403);

        $engineer = null;
        $assigned = [];
        $records = [];
        $stats = [
            'assignedLgus' => 0, 'managedRecords' => 0, 'ongoingRecords' => 0,
            'roadCoverages' => 0, 'projects' => 0, 'lgus' => 0,
        ];

        // Strict identity requires an active linked profile; municipality assignments are not required.
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
            $assigned = DB::table('jairoads_next.lgus as l')
                ->orderBy('l.municipality_name')->get(['l.id', 'l.municipality_name'])
                ->map(static fn ($l): array => ['id' => (int) $l->id, 'name' => (string) $l->municipality_name])->all();
            // Available municipalities and active profile assignments are
            // distinct. Engineers may browse all municipalities, but the
            // assignment metric must count only their actual active links.
            $stats['assignedLgus'] = (int) DB::table('jairoads_next.engineer_lgus')
                ->where('engineer_id', $id)->where('is_active', true)
                ->distinct()->count('lgu_id');
            $stats['lgus'] = count($assigned);
            $stats['roadCoverages'] = (int) DB::table('jairoads_next.road_coverages')->count();
            $stats['projects'] = (int) DB::table('jairoads_next.maintenance_projects')->count();

            // Dashboard lists own managed records across municipalities.
            $scope = DB::table('jairoads_next.maintenance_records as mr')
                ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
                ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
                ->where('mr.managing_engineer_id', $id);
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
            $stats['managedRecords'] = (int) DB::table('jairoads_next.maintenance_records')->whereNotNull('project_id')->count();
            $stats['ongoingRecords'] = (int) DB::table('jairoads_next.maintenance_records')->whereNotNull('project_id')
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

        // Creator account and managing Engineer are distinct foreign keys.
        // Viewers receive the same inventory, with no personalized relationship flags.

        $notifications = array_map(static fn (array $n): array => ['id' => $n['id'], 'message' => $n['notification_message'], 'createdAt' => $n['created_at']], app(ActivityNotifications::class)->feed($actor['account_id'], 8));

        $username = DB::table('jairoads_next.user_accounts')
            ->where('id', $actor['account_id'])->value('username');

        return Inertia::render('RoleDashboard/Canonical', [
            'role' => strtolower($actor['role']),
            'name' => (string) $user->name,
            'username' => (string) $username,
            'engineer' => $engineer,
            'assignedLgus' => $assigned,
            'limitedAccess' => false,
            'stats' => $stats,
            'analytics' => app(DashboardAnalytics::class)->summary($actor),
            'records' => $records,
            'notifications' => $notifications,
            'canonicalFrontend' => true,
            'jairoadsIdentity' => ['role' => strtolower($actor['role'])],
            'navigationSection' => 'dashboard',
        ]);
    }
}
