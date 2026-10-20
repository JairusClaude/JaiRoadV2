<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Support\Facades\DB;

/** Read-only summary: source data is the approved jairoads_next business schema. *
 * @phpstan-import-type Identity from DataDictionaryIdentityResolver
 */
final class DdDashboardAnalytics
{
    /**
     * @param  Identity  $actor
     * @return array{scope: string, metrics: array<string, int|float|null>, trend: list<array{month: string, count: int}>, activity: array<int, array{id: int, action: string, entity: string, username: string, role: string, at: string}>, logins: array<int, array{id: int, username: string, role: string, at: string}>, trackingNote: string}
     */
    public function summary(array $actor): array
    {
        $role = (string) $actor['role'];
        $accountId = (int) $actor['account_id'];
        $engineerId = $actor['engineer_id'];
        $manager = in_array($role, ['SuperAdmin', 'Admin'], true);
        $scope = null;
        $lgus = [];
        if ($role === 'Engineer') {
            $lgus = $engineerId === null ? [] : DB::table('jairoads_next.engineer_lgus')
                ->where('engineer_id', $engineerId)->where('is_active', true)
                ->pluck('lgu_id')->all();
            // One engineer sees only records they manage in active assigned LGUs.
            $scope = DB::table('jairoads_next.maintenance_records as mr')
                ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
                ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
                ->where('mr.managing_engineer_id', $engineerId ?? -1)->whereIn('r.lgu_id', $lgus);
        }
        $records = $scope ?? DB::table('jairoads_next.maintenance_records');
        $recordIds = $scope ? (clone $scope)->select('mr.id') : null;
        $updated = DB::table('jairoads_next.monthly_updates');
        if ($recordIds !== null) {
            $updated->whereIn('maintenance_id', $recordIds);
        }
        $docs = DB::table('jairoads_next.maintenance_documents');
        if ($recordIds !== null) {
            $docs->whereIn('maintenance_id', $recordIds);
        }
        $total = (int) (clone $records)->count();
        $ongoing = (int) (clone $records)->where($scope ? 'mr.status' : 'status', 'Ongoing')->count();
        $completed = (int) (clone $records)->where($scope ? 'mr.status' : 'status', 'Completed')->count();
        $ongoingIds = $scope
            ? (clone $scope)->where('mr.status', 'Ongoing')->select('mr.id')
            : DB::table('jairoads_next.maintenance_records')->where('status', 'Ongoing')->select('id');
        $reportedOngoing = $ongoing > 0
            ? (int) DB::table('jairoads_next.monthly_updates')
                ->where('update_month', now()->format('Y-m'))
                ->whereIn('maintenance_id', $ongoingIds)->distinct()->count('maintenance_id')
            : 0;
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = now()->startOfMonth()->subMonths($i);
            $months[$m->format('Y-m')] = 0;
        }
        $trend = (clone $updated)
            ->selectRaw('SUBSTRING(update_month, 1, 7) AS month, COUNT(*) AS total')
            ->whereIn(DB::raw('SUBSTRING(update_month, 1, 7)'), array_keys($months))
            ->groupBy(DB::raw('SUBSTRING(update_month, 1, 7)'))
            ->pluck('total', 'month')->all();
        foreach ($trend as $month => $count) {
            if (array_key_exists($month, $months)) {
                $months[$month] = (int) $count;
            }
        }

        $activity = [];
        $loginActivity = [];
        if ($manager) {
            $audit = DB::table('jairoads_next.audit_logs as l')
                ->join('jairoads_next.user_accounts as u', 'u.id', '=', 'l.user_id')
                ->whereNull('l.recipient_user_id'); // exclude fan-out notification copies
            if ($role === 'Admin') {
                $audit->where(function ($q) use ($accountId): void {
                    $q->where('l.user_id', $accountId)->orWhereIn('u.account_type', ['Engineer', 'Viewer']);
                });
            }
            $activity = (clone $audit)->orderByDesc('l.created_at')->orderByDesc('l.id')->limit(7)
                ->get(['l.id', 'l.action', 'l.entity_type', 'l.created_at', 'u.username', 'u.account_type'])
                ->map(static fn ($v): array => [
                    'id' => (int) $v->id, 'action' => (string) $v->action,
                    'entity' => (string) $v->entity_type, 'username' => (string) $v->username,
                    'role' => (string) $v->account_type, 'at' => (string) $v->created_at,
                ])->all();
            $loginActivity = (clone $audit)->where('l.action', 'LOGIN')->orderByDesc('l.created_at')->limit(8)
                ->get(['l.id', 'l.created_at', 'u.username', 'u.account_type'])
                ->map(static fn ($v): array => [
                    'id' => (int) $v->id, 'username' => (string) $v->username,
                    'role' => (string) $v->account_type, 'at' => (string) $v->created_at,
                ])->all();
        }

        return [
            'scope' => match ($role) {
                'SuperAdmin' => 'System-wide', 'Admin' => 'Operations overview',
                'Engineer' => 'My assigned work', default => 'Read-only inventory',
            },
            'metrics' => [
                'records' => $total,
                'ongoing' => $ongoing,
                'completed' => $completed,
                'reportingCoverage' => $ongoing ? round($reportedOngoing / $ongoing * 100, 1) : null,
                'updates' => (int) (clone $updated)->count(),
                'documents' => (int) (clone $docs)->count(),
                'lgus' => $role === 'Engineer' ? count($lgus) : (int) DB::table('jairoads_next.lgus')->count(),
                'roads' => $role === 'Engineer' ? (int) DB::table('jairoads_next.road_coverages')->whereIn('lgu_id', $lgus)->count() : (int) DB::table('jairoads_next.road_coverages')->count(),
                'projects' => $role === 'Engineer' ? (int) DB::table('jairoads_next.maintenance_projects')->whereIn('road_coverage_id', DB::table('jairoads_next.road_coverages')->whereIn('lgu_id', $lgus)->select('id'))->count() : (int) DB::table('jairoads_next.maintenance_projects')->count(),
            ],
            'trend' => array_map(static fn ($month, $count): array => ['month' => $month, 'count' => $count], array_keys($months), array_values($months)),
            'activity' => $activity,
            'logins' => $loginActivity,
            'trackingNote' => 'Sign-in history begins when login auditing is enabled. It is not a live online-users count.',
        ];
    }
}
