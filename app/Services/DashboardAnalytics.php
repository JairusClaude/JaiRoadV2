<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Read-only summary: source data is the approved jairoads_next business schema. */
final class DashboardAnalytics
{
    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array<string,mixed>
     */
    public function summary(array $actor): array
    {
        $role = (string) $actor['role'];
        abort_unless(in_array($role, ['SuperAdmin', 'Admin', 'Engineer', 'Viewer'], true), 403);
        $engineerId = $actor['engineer_id'];
        $manager = in_array($role, ['SuperAdmin', 'Admin'], true);
        $scope = null;
        if ($role === 'Engineer') {
            // Own managed records across municipalities.
            $scope = DB::table('jairoads_next.maintenance_records as mr')
                ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
                ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
                ->where('mr.managing_engineer_id', $engineerId ?? -1);
        }
        if ($role === 'Viewer') {
            // Read-only inventory excludes detached Admin-only historical context.
            $scope = DB::table('jairoads_next.maintenance_records as mr')
                ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
                ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id');
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
        $statusColumn = $scope ? 'mr.status' : 'status';
        $counts = (clone $records)->selectRaw("COUNT(*) AS total, COUNT(*) FILTER (WHERE {$statusColumn} = ?) AS ongoing, COUNT(*) FILTER (WHERE {$statusColumn} = ?) AS completed", ['Ongoing', 'Completed'])->first();
        $total = (int) ($counts->total ?? 0);
        $ongoing = (int) ($counts->ongoing ?? 0);
        $completed = (int) ($counts->completed ?? 0);
        $reportingMonth = now('Asia/Manila')->startOfMonth();
        $ongoingIds = $scope
            ? (clone $scope)->where('mr.status', 'Ongoing')->select('mr.id')
            : DB::table('jairoads_next.maintenance_records')->where('status', 'Ongoing')->select('id');
        $reportedOngoing = $ongoing > 0
            ? (int) DB::table('jairoads_next.monthly_updates')
                ->where('update_month', $reportingMonth->format('Y-m'))
                ->whereIn('maintenance_id', $ongoingIds)->distinct()->count('maintenance_id')
            : 0;
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = $reportingMonth->copy()->subMonths($i);
            $months[$m->format('Y-m')] = 0;
        }
        $trend = (clone $updated)
            ->selectRaw('update_month AS month, COUNT(*) AS total')
            ->whereIn('update_month', array_keys($months))
            ->groupBy('update_month')
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
                ->whereNull('l.recipient_user_id')->whereNotIn('l.action', ['LOGIN', 'LOGOUT']); // business events only
            $activity = (clone $audit)->orderByDesc('l.created_at')->orderByDesc('l.id')->limit(7)
                ->get(['l.id', 'l.action', 'l.entity_type', 'l.created_at', 'l.actor_identifier', 'u.account_type'])
                ->map(static fn ($v): array => [
                    'id' => (int) $v->id, 'action' => (string) $v->action,
                    'entity' => (string) $v->entity_type, 'username' => AuditActorIdentifier::display((string) $v->actor_identifier),
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
                'lgus' => (int) DB::table('jairoads_next.lgus')->count(),
                'roads' => (int) DB::table('jairoads_next.road_coverages')->count(),
                'projects' => (int) DB::table('jairoads_next.maintenance_projects')->count(),
            ],
            'trend' => array_map(static fn ($month, $count): array => ['month' => $month, 'count' => $count], array_keys($months), array_values($months)),
            'activity' => $activity,
            'logins' => $loginActivity,
            'trackingNote' => 'Sign-in history is not collected in the business AuditLog. Historical sign-in entries remain in administrator audit history.',
        ];
    }
}
