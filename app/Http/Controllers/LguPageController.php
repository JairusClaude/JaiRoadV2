<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\RoleAccess;
use App\Services\OperationAudit;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;
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
                $assignmentCount = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $lgu->id)->count();

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
            ->orderByDesc('el.is_active')->orderBy('e.last_name')->orderBy('e.id')
            ->get(['e.id', 'e.first_name', 'e.last_name', 'e.rank', 'el.is_active']);

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
                'engineer_id' => (int) $e->id,
                'full_name' => trim($e->first_name.' '.$e->last_name),
                'rank' => $e->rank,
                'assignment_is_active' => (bool) $e->is_active,
            ])->all(),
            'relationshipDataAvailable' => ['roadCoverages' => true, 'engineerAssignments' => true],
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

        if ($id === null) {
            // New LGUs are within the system's fixed provincial coverage.
            $request->merge(['province' => 'Davao De Oro', 'region' => 'XI']);
        }
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
        $directory = self::BASE.'/lgus';
        $detail = $directory.'/'.$id;
        return redirect($this->editReturn($request, $detail, [$directory, $detail]))->with('dd_operations_status', 'LGU updated successfully.');
    }

    public function deleteLgu(Request $request, int $id): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::deleteLgu($request, $id);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete LGUs.');

        $this->deleteCheckedLgus($actor, [$id]);

        return redirect(self::BASE.'/lgus')->with('dd_operations_status', 'LGU deleted successfully.');
    }

    public function bulkDestroy(Request $request): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::bulkDestroyLgu($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete LGUs.');

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'min:1', 'distinct'],
        ]);
        $this->deleteCheckedLgus($actor, array_map('intval', $validated['ids']));

        return redirect(self::BASE.'/lgus')->with('dd_operations_status', 'Selected LGUs deleted successfully.');
    }

    /** Dependency checks, removal and canonical audit/notification delivery are atomic. */
    private function deleteCheckedLgus(array $actor, array $ids): void
    {
        try {
            DB::transaction(function () use ($actor, $ids): void {
                $rows = DB::table('jairoads_next.lgus')->whereIn('id', $ids)
                    ->orderBy('id')->lockForUpdate()->get();
                abort_unless($rows->count() === count($ids), 404);

                foreach ($rows as $row) {
                    $roads = DB::table('jairoads_next.road_coverages')->where('lgu_id', $row->id)->exists();
                    $assignments = DB::table('jairoads_next.engineer_lgus')->where('lgu_id', $row->id)->exists();
                    if ($roads || $assignments) {
                        throw ValidationException::withMessages(['delete' => 'Cannot delete '.$row->municipality_name.': it still has road coverage or historical engineer assignment references.']);
                    }
                }
                foreach ($rows as $row) {
                    DB::table('jairoads_next.lgus')->where('id', $row->id)->delete();
                    app(OperationAudit::class)->record($actor, 'DELETE', 'LGU', (int) $row->id,
                        'Authorized LGU deleted after dependency checks.', [], (array) $row);
                }
            });
        } catch (QueryException $error) {
            if ($error->getCode() === '23503') {
                throw ValidationException::withMessages(['delete' => 'An associated record prevents deletion. Refresh and review the LGU dependencies.']);
            }
            throw $error;
        }
    }
}
