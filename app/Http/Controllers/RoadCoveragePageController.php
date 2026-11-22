<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\OperationAudit;
use App\Services\PreviewDataService;
use App\Services\RoadReferenceBounds;
use App\Services\RoleAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Response;

/**
 * Canonical road coverage pages, writes and map reference feed.
 *
 * Inherits the existing role/identity/operation guards to preserve behavior
 * while resource-specific pages are moved out of the transitional controller.
 */
final class RoadCoveragePageController extends OperationsFrontendController
{
    public function roadIndex(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::roadIndex($request);
        }

        $actor = $this->actor($request);
        $filters = $request->only(['search', 'municipality', 'condition', 'pavement', 'sort'])
            + ['search' => '', 'municipality' => 'all', 'condition' => 'all', 'pavement' => 'all', 'sort' => 'newest'];
        $query = $this->roads($actor);
        if (is_string($filters['search']) && $filters['search'] !== '') {
            $query->where('rc.road_name', 'ilike', '%'.substr($filters['search'], 0, 255).'%');
        }
        foreach (['municipality' => 'rc.lgu_id', 'condition' => 'rc.state_category', 'pavement' => 'rc.pavement_type'] as $key => $column) {
            if (is_string($filters[$key]) && $filters[$key] !== '' && $filters[$key] !== 'all') {
                if ($key !== 'municipality' || ctype_digit($filters[$key])) {
                    $query->where($column, $filters[$key]);
                }
            }
        }
        $query->orderBy(in_array($filters['sort'], ['name-asc', 'name-desc'], true) ? 'rc.road_name' : 'rc.id',
            in_array($filters['sort'], ['oldest', 'name-asc'], true) ? 'asc' : 'desc');

        $totalCoverages = (int) DB::table('jairoads_next.road_coverages')->count();
        $linkedProjects = (int) DB::table('jairoads_next.maintenance_projects')->whereNotNull('road_coverage_id')->distinct()->count('id');
        $totalLengthKm = (float) (DB::table('jairoads_next.road_coverages')->sum('kilometers') ?? 0);

        // Keep initial Inertia payload bounded. The user can progressively load
        // further map geometries through the read-only, cursor-based endpoint.
        $mapPage = $this->roadMapData($actor);

        return $this->render('RoadCoverages/Index', $request, [
            'totalCoverages' => $totalCoverages,
            'linkedProjects' => $linkedProjects,
            'totalLengthKm' => $totalLengthKm,
            'mapCoverages' => $mapPage['data'],
            'mapNextCursor' => $mapPage['next_cursor'],
            'coverages' => $query->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->roadData($r)),
            'municipalities' => $this->municipalities($actor), 'filters' => $filters, 'canEdit' => $this->writable($actor),
            'canDelete' => RoleAccess::canDeleteOperations($actor['role']),
        ]);
    }

    /** Read-only map geometry batches for all eligible canonical roles. */
    public function roadMapPage(Request $request): JsonResponse
    {
        if (self::isPreview($request)) {
            return response()->json(['data' => [], 'next_cursor' => null])
                ->header('Cache-Control', 'private, no-store');
        }

        $actor = $this->actor($request);
        $v = $request->validate(['before' => ['required', 'integer', 'min:1']]);

        return response()->json($this->roadMapData($actor, (int) $v['before']))
            ->header('Cache-Control', 'private, no-store');
    }

    /**
     * Newest-first keyset pagination avoids materializing every stored GeoJSON
     * value on a road-index visit. Never skip existing roads; all are reachable
     * through the next cursor without reloading already-seen records.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array{data:array<int,array<string,mixed>>,next_cursor:?int}
     */
    private function roadMapData(array $actor, ?int $before = null): array
    {
        $query = $this->scope(DB::table('jairoads_next.road_coverages as rc')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id'), $actor);
        if ($before !== null) {
            $query->where('rc.id', '<', $before);
        }
        $rows = $query->orderByDesc('rc.id')->limit(101)
            ->get(['rc.id', 'rc.road_name', 'rc.geojson', 'l.municipality_name', 'p.id as project_id']);
        $page = $rows->take(100);

        return [
            'data' => $page->map(static fn (\stdClass $road): array => [
                'id' => (int) $road->id,
                'road_name' => (string) $road->road_name,
                'municipality' => (string) $road->municipality_name,
                'assigned' => $road->project_id !== null,
                'geojson' => json_decode((string) $road->geojson, true, 512, JSON_THROW_ON_ERROR),
            ])->values()->all(),
            'next_cursor' => $rows->count() > 100 ? (int) $page->last()->id : null,
        ];
    }

    public function roadShow(Request $request, int $id): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::roadShow($request, $id);
        }

        $actor = $this->actor($request);
        $road = $this->roads($actor)->where('rc.id', $id)->first();
        abort_unless($road !== null, 404);

        return $this->render('RoadCoverages/Show', $request, [
            'coverage' => $this->roadData($road), 'createdByName' => trim($road->first_name.' '.$road->last_name),
            'associatedProject' => $road->project_id === null ? null : ['id' => (int) $road->project_id, 'project_title' => $road->project_title],
            'canEdit' => $this->writable($actor),
            'canDelete' => RoleAccess::canDeleteOperations($actor['role']),
            'backUrl' => self::BASE.'/road-coverages',
            'municipalities' => $this->municipalities($actor),
        ]);
    }

    public function roadForm(Request $request, ?int $id = null): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::roadForm($request, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $road = $id === null ? null : $this->roads($actor)->where('rc.id', $id)->first();
        abort_if($id !== null && $road === null, 404);
        $creators = DB::table('jairoads_next.engineers as e')->where('e.engineer_status', 'Active')
            ->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->where('e.id', $actor['engineer_id']))
            ->orderBy('e.last_name')->get(['e.id', 'e.first_name', 'e.last_name']);

        return $this->render('RoadCoverages/'.($id === null ? 'Create' : 'Edit'), $request, [
            'coverage' => $road === null ? null : $this->roadData($road),
            'municipalities' => $this->municipalities($actor), 'roadCreatorChoices' => $creators,
            'requiresCreator' => $id === null && RoleAccess::managesBusinessData($actor['role']),
            'referenceCoverages' => [], 'referenceUrl' => self::BASE.'/map/roads',
            'mapServices' => ['routing' => config('jairoads_maps.routing'), 'geocoding' => config('jairoads_maps.geocoding')],
            'canEdit' => true, 'cancelUrl' => self::BASE.'/road-coverages'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function roadReferences(Request $request): JsonResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::roadReferences($request);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $v = $request->validate([
            'west' => ['required', 'numeric', 'between:-180,180'], 'east' => ['required', 'numeric', 'between:-180,180', 'gte:west'],
            'south' => ['required', 'numeric', 'between:-90,90'], 'north' => ['required', 'numeric', 'between:-90,90', 'gte:south'],
            'lgu_id' => ['nullable', 'integer', 'min:1'], 'q' => ['nullable', 'string', 'max:255'], 'after' => ['nullable', 'integer', 'min:0'],
        ]);
        $q = $this->scope(DB::table('jairoads_next.road_coverages as rc'), $actor)
            ->when(isset($v['lgu_id']), fn (Builder $q) => $q->where('rc.lgu_id', $v['lgu_id']))
            ->when(! empty($v['q']), fn (Builder $q) => $q->where('rc.road_name', 'ilike', '%'.$v['q'].'%'))
            ->where('rc.id', '>', $v['after'] ?? 0);
        RoadReferenceBounds::apply($q, (float) $v['west'], (float) $v['south'], (float) $v['east'], (float) $v['north']);
        $rows = $q->orderBy('rc.id')->limit(101)->get(['rc.id', 'rc.road_name', 'rc.lgu_id', 'rc.kilometers', 'rc.pavement_type', 'rc.state_category', 'rc.geojson']);
        $page = $rows->take(100);

        return response()->json(['data' => $page->map(fn (\stdClass $r): array => [
            'id' => (int) $r->id, 'road_name' => $r->road_name, 'lgus_id' => (int) $r->lgu_id,
            'kilometers' => $r->kilometers, 'pavement_type' => $r->pavement_type, 'state_category' => $r->state_category,
            'geojson' => json_decode($r->geojson, true, 512, JSON_THROW_ON_ERROR),
        ])->values(), 'next_cursor' => $rows->count() > 100 ? (int) $page->last()->id : null])
            ->header('Cache-Control', 'private, no-store');
    }

    public function saveRoad(Request $request, ?int $id = null): RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::saveRoad($request, $id);
        }

        $this->writer($this->actor($request));
        $this->inputAlias($request, 'lgus_id', 'lgu_id');
        if ($request->exists('geojson')) {
            $geometry = $request->input('geojson');
            $request->merge(['geojson' => is_array($geometry) ? json_encode($geometry, JSON_THROW_ON_ERROR) : $geometry]);
        }
        $this->write(fn () => $this->operations->saveRoad($request, $this->identities, $id), ['lgu_id' => 'lgus_id']);

        $directory = self::BASE.'/road-coverages';
        $fallback = $id === null ? $directory : $directory.'/'.$id;

        return redirect($this->editReturn($request, $fallback, [$directory, $fallback]))->with('dd_operations_status', 'Road coverage saved to the database.');
    }

    public function deleteRoad(Request $request, int $id): RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::deleteRoad($request, $id);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete road coverages.');
        $this->deleteCheckedRoads($request, $actor, [$id]);

        return redirect(self::BASE.'/road-coverages')->with('dd_operations_status', 'Road coverage deleted successfully.');
    }

    public function bulkDeleteRoad(Request $request): RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::bulkDeleteRoad($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete road coverages.');
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'min:1', 'distinct'],
        ]);
        $this->deleteCheckedRoads($request, $actor, array_map('intval', $validated['ids']));

        return redirect(self::BASE.'/road-coverages')->with('dd_operations_status', 'Selected road coverages deleted successfully.');
    }

    /**
     * Lock target roads first, then check children, delete, and record canonical
     * audit/notification events in the same transaction. A project insert must
     * acquire a key-share lock on its road parent, so it cannot race this delete.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  list<int>  $ids
     */
    private function deleteCheckedRoads(Request $request, array $actor, array $ids): void
    {
        sort($ids);
        try {
            DB::transaction(function () use ($request, $actor, $ids): void {
                $rows = DB::table('jairoads_next.road_coverages')
                    ->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
                abort_unless($rows->count() === count($ids), 404);
                abort_unless($this->actor($request) === $actor && RoleAccess::canDeleteOperations($actor['role']), 403);

                $attached = DB::table('jairoads_next.maintenance_projects')
                    ->whereIn('road_coverage_id', $ids)->pluck('road_coverage_id')->all();
                if ($attached !== []) {
                    throw ValidationException::withMessages([
                        'delete' => 'One or more selected roads are referenced by maintenance projects. Remove those dependencies before deleting roads.',
                    ]);
                }

                foreach ($rows as $row) {
                    DB::table('jairoads_next.road_coverages')->where('id', $row->id)->delete();
                    app(OperationAudit::class)->record(
                        $actor, 'DELETE', 'RoadCoverage', (int) $row->id,
                        'Authorized RoadCoverage deleted after dependency checks.', [], (array) $row,
                    );
                }
            });
        } catch (QueryException $error) {
            if (($error->errorInfo[0] ?? null) === '23503') {
                throw ValidationException::withMessages([
                    'delete' => 'A maintenance project now references a selected road. Refresh and try again.',
                ]);
            }

            throw $error;
        }
    }
}
