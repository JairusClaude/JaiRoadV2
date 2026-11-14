<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\RoleAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Response;

final class LguPageController extends OperationsFrontendController
{
    public function lguIndex(Request $request): Response
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::lguIndex($request);
        }

        $actor = $this->actor($request);
        $search = trim((string) $request->query('search', ''));
        $province = trim((string) $request->query('province', ''));
        $region = trim((string) $request->query('region', ''));
        $sort = strtolower((string) $request->query('sort', 'asc')) === 'desc' ? 'desc' : 'asc';

        $query = DB::table('jairoads_next.lgus');

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where('municipality_name', 'ilike', $like)
                    ->orWhere('province', 'ilike', $like)
                    ->orWhere('region', 'ilike', $like)
                    ->orWhere('mayor_first_name', 'ilike', $like)
                    ->orWhere('mayor_middle_name', 'ilike', $like)
                    ->orWhere('mayor_last_name', 'ilike', $like);
            });
        }

        if ($province !== '' && $province !== 'all') {
            $query->where('province', $province);
        }

        if ($region !== '' && $region !== 'all') {
            $query->where('region', $region);
        }

        $paginated = $query
            ->orderBy('municipality_name', $sort)
            ->paginate(10)
            ->withQueryString();

        $lgus = [
            'data' => collect($paginated->items())->map(function (\stdClass $lgu): array {
                $roadCount = DB::table('jairoads_next.road_coverages')->where('lgu_id', $lgu->id)->count();
                $assignmentCount = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $lgu->id)->where('is_active', true)->count();

                return [
                    'id' => (int) $lgu->id,
                    'municipality_name' => $lgu->municipality_name,
                    'province' => $lgu->province,
                    'region' => $lgu->region,
                    'mayor_first_name' => $lgu->mayor_first_name,
                    'mayor_middle_name' => $lgu->mayor_middle_name,
                    'mayor_last_name' => $lgu->mayor_last_name,
                    'deletion_check' => [
                        'available' => true,
                        'road_coverages' => $roadCount,
                        'engineer_assignments' => $assignmentCount,
                    ],
                ];
            })->all(),
            'total' => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'from' => $paginated->firstItem(),
            'to' => $paginated->lastItem(),
        ];

        $provinces = DB::table('jairoads_next.lgus')->distinct()->whereNotNull('province')->orderBy('province')->pluck('province')->all();
        $regions = DB::table('jairoads_next.lgus')->distinct()->whereNotNull('region')->orderBy('region')->pluck('region')->all();

        $canDelete = RoleAccess::canDeleteOperations($actor['role']);
        $canEdit = $this->writable($actor);

        return $this->render('LGUs/Index', $request, [
            'totalMunicipalities' => DB::table('jairoads_next.lgus')->count(),
            'totalRoadCoverages' => DB::table('jairoads_next.road_coverages')->count(),
            'totalEngineerAssignments' => DB::table('jairoads_next.engineer_lgus')->where('is_active', true)->count(),
            'lgus' => $lgus,
            'filters' => [
                'search' => $search,
                'province' => $province,
                'region' => $region,
                'sort' => $sort,
            ],
            'provinces' => $provinces,
            'regions' => $regions,
            'lguPermissions' => [
                'can_edit' => $canEdit,
                'can_delete' => $canDelete,
            ],
            'canBulkDelete' => $canDelete,
            'canDelete' => $canDelete,
        ]);
    }

    public function lguShow(Request $request, int $id): Response
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::lguShow($request, $id);
        }

        $actor = $this->actor($request);
        $row = DB::table('jairoads_next.lgus')->where('id', $id)->first();
        abort_unless($row !== null, 404);

        $roads = DB::table('jairoads_next.road_coverages')->where('lgu_id', $id)->get();
        $assignments = DB::table('jairoads_next.engineer_lgus as el')
            ->join('jairoads_next.engineers as e', 'e.id', '=', 'el.engineer_id')
            ->where('el.lgu_id', $id)
            ->where('el.is_active', true)
            ->get(['e.id', 'e.first_name', 'e.last_name', 'e.rank']);

        $canDelete = RoleAccess::canDeleteOperations($actor['role']);
        $canEdit = $this->writable($actor);

        return $this->render('LGUs/Show', $request, [
            'lgu' => [
                'id' => (int) $row->id,
                'municipality_name' => $row->municipality_name,
                'province' => $row->province,
                'region' => $row->region,
                'mayor_first_name' => $row->mayor_first_name,
                'mayor_middle_name' => $row->mayor_middle_name,
                'mayor_last_name' => $row->mayor_last_name,
                'deletion_check' => [
                    'available' => true,
                    'road_coverages' => $roads->count(),
                    'engineer_assignments' => $assignments->count(),
                ],
            ],
            'roadCoverages' => $roads->map(fn ($r): array => [
                'id' => (int) $r->id,
                'road_name' => $r->road_name,
                'kilometers' => $r->kilometers,
                'pavement_type' => $r->pavement_type,
                'state_category' => $r->state_category,
            ])->all(),
            'assignedEngineers' => $assignments->map(fn ($e): array => [
                'id' => (int) $e->id,
                'first_name' => $e->first_name,
                'last_name' => $e->last_name,
                'rank' => $e->rank,
            ])->all(),
            'relationshipDataAvailable' => true,
            'directoryUrl' => self::BASE.'/lgus',
            'lguPermissions' => [
                'can_edit' => $canEdit,
                'can_delete' => $canDelete,
            ],
        ]);
    }

    public function lguForm(Request $request, ?int $id = null): Response
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::lguForm($request, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);

        $lgu = null;
        if ($id !== null) {
            $row = DB::table('jairoads_next.lgus')->where('id', $id)->first();
            abort_unless($row !== null, 404);
            $lgu = (array) $row;
        }

        return $this->render($id === null ? 'LGUs/Create' : 'LGUs/Edit', $request, [
            'lgu' => $lgu,
            'cancelUrl' => self::BASE.'/lgus',
        ]);
    }

    public function saveLgu(Request $request, ?int $id = null): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::saveLgu($request, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);

        $v = $request->validate([
            'municipality_name' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'mayor_first_name' => ['required', 'string', 'max:100'],
            'mayor_middle_name' => ['nullable', 'string', 'max:100'],
            'mayor_last_name' => ['required', 'string', 'max:100'],
        ]);

        if ($id === null) {
            DB::table('jairoads_next.lgus')->insert($v);
            return redirect(self::BASE.'/lgus')->with('dd_operations_status', 'LGU created successfully.');
        }

        DB::table('jairoads_next.lgus')->where('id', $id)->update($v);
        return redirect(self::BASE.'/lgus')->with('dd_operations_status', 'LGU updated successfully.');
    }

    public function deleteLgu(Request $request, int $id): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::deleteLgu($request, $id);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete LGUs.');

        $roads = DB::table('jairoads_next.road_coverages')->where('lgu_id', $id)->count();
        $assignments = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $id)->where('is_active', true)->count();
        if ($roads > 0 || $assignments > 0) {
            return back()->withErrors([
                'delete' => 'Cannot delete LGU: it is referenced by road coverages or engineer assignments.',
            ]);
        }

        DB::table('jairoads_next.lgus')->where('id', $id)->delete();
        return redirect(self::BASE.'/lgus')->with('dd_operations_status', 'LGU deleted successfully.');
    }

    public function bulkDestroy(Request $request): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::bulkDestroyLgu($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete LGUs.');

        $ids = $request->input('ids', []);
        if (is_array($ids) && count($ids) > 0) {
            $blocked = [];
            foreach ($ids as $id) {
                $roads = DB::table('jairoads_next.road_coverages')->where('lgu_id', $id)->count();
                $assignments = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $id)->where('is_active', true)->count();
                if ($roads > 0 || $assignments > 0) {
                    $lgu = DB::table('jairoads_next.lgus')->where('id', $id)->first();
                    $blocked[] = $lgu ? $lgu->municipality_name : "ID {$id}";
                }
            }

            if (!empty($blocked)) {
                return back()->withErrors([
                    'ids' => 'Cannot delete the following LGUs because they have active road coverages or assignments: ' . implode(', ', $blocked),
                ]);
            }

            DB::table('jairoads_next.lgus')->whereIn('id', $ids)->delete();
        }

        return redirect(self::BASE.'/lgus')->with('dd_operations_status', 'Selected LGUs deleted successfully.');
    }
}
