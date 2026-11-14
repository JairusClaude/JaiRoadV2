<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\RoadReferenceBounds;
use App\Services\RoleAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            return \App\Services\PreviewDataService::roadIndex($request);
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

        $mapCoverages = DB::table('jairoads_next.road_coverages as rc')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id')
            ->select(['rc.id', 'rc.road_name', 'rc.geojson', 'l.municipality_name', 'p.id as project_id'])
            ->get()
            ->map(fn (\stdClass $r): array => [
                'id' => (int) $r->id,
                'road_name' => $r->road_name,
                'municipality' => $r->municipality_name,
                'assigned' => !empty($r->project_id),
                'geojson' => json_decode($r->geojson, true, 512, JSON_THROW_ON_ERROR),
            ])->all();

        return $this->render('RoadCoverages/Index', $request, [
            'totalCoverages' => $totalCoverages,
            'linkedProjects' => $linkedProjects,
            'totalLengthKm' => $totalLengthKm,
            'mapCoverages' => $mapCoverages,
            'coverages' => $query->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->roadData($r)),
            'municipalities' => $this->municipalities($actor), 'filters' => $filters, 'canEdit' => $this->writable($actor),
            'canDelete' => RoleAccess::canDeleteOperations($actor['role']),
        ]);
    }

    public function roadShow(Request $request, int $id): Response
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::roadShow($request, $id);
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
            return \App\Services\PreviewDataService::roadForm($request, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $road = $id === null ? null : $this->roads($actor)->where('rc.id', $id)->first();
        abort_if($id !== null && $road === null, 404);
        $creators = DB::table('jairoads_next.engineer_lgus as a')
            ->join('jairoads_next.engineers as e', 'e.id', '=', 'a.engineer_id')
            ->where('a.is_active', true)->where('e.engineer_status', 'Active')
            ->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->where('e.id', $actor['engineer_id']))
            ->orderBy('e.last_name')->get(['e.id', 'a.lgu_id', 'e.first_name', 'e.last_name']);

        return $this->render('RoadCoverages/'.($id === null ? 'Create' : 'Edit'), $request, [
            'coverage' => $road === null ? null : $this->roadData($road),
            'municipalities' => $this->municipalities($actor), 'roadCreatorChoices' => $creators,
            'requiresCreator' => false,
            'referenceCoverages' => [], 'referenceUrl' => self::BASE.'/map/roads',
            'mapServices' => ['routing' => config('jairoads_maps.routing'), 'geocoding' => config('jairoads_maps.geocoding')],
            'canEdit' => true, 'cancelUrl' => self::BASE.'/road-coverages'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function roadReferences(Request $request): JsonResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::roadReferences($request);
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
            return \App\Services\PreviewDataService::saveRoad($request, $id);
        }

        $this->writer($this->actor($request));
        $this->inputAlias($request, 'lgus_id', 'lgu_id');
        if ($request->exists('geojson')) {
            $geometry = $request->input('geojson');
            $request->merge(['geojson' => is_array($geometry) ? json_encode($geometry, JSON_THROW_ON_ERROR) : $geometry]);
        }
        $this->write(fn () => $this->operations->saveRoad($request, $this->identities, $id), ['lgu_id' => 'lgus_id']);

        return redirect(self::BASE.'/road-coverages'.($id === null ? '' : '/'.$id))->with('dd_operations_status', 'Road coverage saved to the database.');
    }

    public function deleteRoad(Request $request, int $id): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::deleteRoad($request, $id);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete road coverages.');

        $road = $this->roads($actor)->where('rc.id', $id)->first();
        abort_unless($road !== null, 404);

        if (!empty($road->project_id)) {
            return back()->withErrors(['delete' => "Cannot delete road coverage {$road->road_name} because Maintenance Project {$road->project_title} references it."]);
        }

        DB::transaction(function () use ($id): void {
            $deleted = DB::table('jairoads_next.road_coverages')->where('id', $id)->delete();
            abort_unless($deleted > 0, 404);
        });

        return redirect(self::BASE.'/road-coverages')->with('dd_operations_status', 'Road coverage deleted successfully.');
    }

    public function bulkDeleteRoad(Request $request): RedirectResponse
    {
        if (self::isPreview($request)) {
            return \App\Services\PreviewDataService::bulkDeleteRoad($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete road coverages.');

        $ids = $request->input('ids', []);
        if (is_array($ids) && count($ids) > 0) {
            $blocked = [];
            foreach ($ids as $id) {
                $road = $this->roads($actor)->where('rc.id', $id)->first();
                if ($road && !empty($road->project_id)) {
                    $blocked[] = $road->road_name;
                }
            }

            if (!empty($blocked)) {
                return back()->withErrors(['ids' => 'Cannot delete the following roads because they are referenced by maintenance projects: ' . implode(', ', $blocked)]);
            }

            DB::transaction(function () use ($ids): void {
                DB::table('jairoads_next.road_coverages')->whereIn('id', $ids)->delete();
            });
        }

        return redirect(self::BASE.'/road-coverages')->with('dd_operations_status', 'Selected road coverages deleted successfully.');
    }
}
