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
            ->select(['m.id', 'm.start_date', 'p.project_title'])
            ->selectRaw('m.start_date + m.estimated_duration_days as estimated_finish')
            ->orderBy('estimated_finish')->orderBy('m.id')->limit(12)->get()
            ->map(static fn (\stdClass $row): array => [
                'id' => (int) $row->id,
                'projectTitle' => (string) $row->project_title,
                'startDate' => (string) $row->start_date,
                'estimatedFinish' => (string) $row->estimated_finish,
            ])->all();

        return [
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
