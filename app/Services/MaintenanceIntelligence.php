<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Read-only aggregates for the already-authorized canonical SuperAdmin dashboard. */
final class MaintenanceIntelligence
{
    /** @return array<string,mixed> */
    public function summary(): array
    {
        $today = now('Asia/Manila')->toDateString();
        $month = substr($today, 0, 7);
        $conditions = DB::table('jairoads_next.road_coverages')
            ->selectRaw('state_category, count(*) as total')
            ->groupBy('state_category')
            ->pluck('total', 'state_category');
        $ongoing = DB::table('jairoads_next.maintenance_records as m')
            ->where('m.status', 'Ongoing');
        $noReport = (clone $ongoing)
            ->where('m.start_date', '<=', $today)
            ->whereNotExists(static function ($query) use ($month): void {
                $query->selectRaw('1')->from('jairoads_next.monthly_updates as u')
                    ->whereColumn('u.maintenance_id', 'm.id')
                    ->where('u.update_month', $month);
            })
            ->count();
        $pastEstimate = (clone $ongoing)
            ->whereRaw('m.start_date + m.estimated_duration_days < CAST(? AS date)', [$today])
            ->count();
        $calendar = (clone $ongoing)
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->select(['m.id', 'm.project_id', 'm.start_date', 'p.project_title'])
            ->selectRaw('m.start_date + m.estimated_duration_days as estimated_finish')
            ->orderBy('estimated_finish')->orderBy('m.id')->limit(12)->get()
            ->map(static fn (\stdClass $row): array => [
                'id' => (int) $row->id,
                'projectId' => (int) $row->project_id,
                'projectTitle' => (string) $row->project_title,
                'startDate' => (string) $row->start_date,
                'estimatedFinish' => (string) $row->estimated_finish,
            ])->all();

        // Provisional review index, not a safety inspection or approved dispatch decision.
        // Aggregate by road before scoring so multiple records cannot multiply a factor.
        $signals = DB::table('jairoads_next.road_coverages as rc')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id')
            ->leftJoin('jairoads_next.maintenance_records as m', static function ($join): void {
                $join->on('m.project_id', '=', 'p.id')->where('m.status', '=', 'Ongoing');
            })
            ->whereIn('rc.state_category', ['Good', 'Fair', 'Bad'])
            ->select(['rc.id', 'rc.road_name', 'rc.state_category'])
            ->selectRaw("case rc.state_category when 'Bad' then 60 when 'Fair' then 30 else 0 end as condition_score")
            ->selectRaw('max(case when m.start_date + m.estimated_duration_days < cast(? as date) then 25 else 0 end) as overdue_score', [$today])
            ->selectRaw('max(case when m.start_date <= cast(? as date) and not exists (select 1 from jairoads_next.monthly_updates u where u.maintenance_id = m.id and u.update_month = ?) then 15 else 0 end) as report_score', [$today, $month])
            ->groupBy('rc.id', 'rc.road_name', 'rc.state_category');
        $priority = DB::query()->fromSub($signals, 'signals')
            ->select(['id', 'road_name', 'state_category', 'condition_score', 'overdue_score', 'report_score'])
            ->selectRaw('condition_score + overdue_score + report_score as score, count(*) over () as review_total')
            ->whereRaw('condition_score + overdue_score + report_score > 0')
            ->orderByDesc('score')->orderBy('id')->limit(12)->get();
        $priorityTotal = (int) ($priority->first()->review_total ?? 0);
        $priority = $priority->map(static fn (\stdClass $row): array => [
            'id' => (int) $row->id,
            'roadName' => (string) $row->road_name,
            'condition' => (string) $row->state_category,
            'conditionScore' => (int) $row->condition_score,
            'overdueScore' => (int) $row->overdue_score,
            'reportScore' => (int) $row->report_score,
            'score' => (int) $row->score,
        ])->all();

        return [
            'priority' => $priority,
            'priorityTotal' => $priorityTotal,
            'asOf' => $today,
            'reportingMonth' => $month,
            'conditions' => [
                'Good' => (int) ($conditions['Good'] ?? 0),
                'Fair' => (int) ($conditions['Fair'] ?? 0),
                'Bad' => (int) ($conditions['Bad'] ?? 0),
            ],
            'noCurrentReport' => (int) $noReport,
            'pastEstimate' => (int) $pastEstimate,
            'ongoingCount' => (int) (clone $ongoing)->count(),
            'calendar' => $calendar,
        ];
    }
}
