<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\LiteralDirectorySearch;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Maintenance project pages and creation/update handlers.
 *
 * Inherits established identity and scope checks. Project deletion and record
 * mutation continue to use their existing dedicated handlers and routes.
 */
final class MaintenanceProjectPageController extends OperationsFrontendController
{
    public function projectIndex(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::projectIndex($request);
        }

        $actor = $this->actor($request);
        $filters = ['search' => LiteralDirectorySearch::normalize($request->query('search')), 'municipality' => LiteralDirectorySearch::option($request->query('municipality')), 'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->projects($actor, false)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', LiteralDirectorySearch::pattern($filters['search'])));
        if (ctype_digit($filters['municipality'])) {
            $q->where('rc.lgu_id', $filters['municipality']);
        }

        return $this->render('MaintenanceProjects/Index', $request, [
            'projects' => $q->orderBy('p.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'municipalities' => $this->municipalities($actor), 'filters' => $filters,
            'integration' => ['ready' => true, 'message' => null], 'canCreate' => $this->writable($actor), 'canBulkDelete' => RoleAccess::canDeleteOperations($actor['role']),
        ]);
    }

    public function projectForm(Request $request, ?int $id = null): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::projectForm($request, $id);
        }

        $actor = $this->actor($request);
        $this->writer($actor);
        $p = $id === null ? null : $this->projects($actor)->where('p.id', $id)->first();
        abort_if($id !== null && $p === null, 404);

        return $this->render('MaintenanceProjects/'.($id === null ? 'Create' : 'Edit'), $request, [
            'project' => $p === null ? null : $this->projectData($p, $actor),
            // Include assigned roads for the reference-only toggle. In edit mode
            // the current project's own road remains selectable.
            'coverages' => $this->roads($actor)
                ->orderBy('rc.road_name')->orderBy('rc.id')->get()->map(fn (\stdClass $r): array => [
                    'id' => (int) $r->id, 'road_name' => $r->road_name,
                    'municipality' => $r->municipality_name, 'kilometers' => $r->kilometers,
                    'assigned' => $r->project_id !== null && ($id === null || (int) $r->project_id !== $id),
                    'assigned_project_title' => $r->project_id !== null && ($id === null || (int) $r->project_id !== $id) ? $r->project_title : null,
                    'geojson' => json_decode($r->geojson, true, 512, JSON_THROW_ON_ERROR),
                ]),
            'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public function saveProject(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        $this->operations->saveProject($request, $this->identities, $id);

        $directory = self::BASE.'/maintenance-projects';
        $fallback = $id === null ? $directory : $directory.'/'.$id;
        $return = $this->editReturn($request, $fallback, [$directory, $fallback]);

        return redirect($return)->with('jairoads_operations_status', 'Maintenance Project saved to the database.');
    }

    public function projectShow(Request $request, int $id): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::projectShow($request, $id);
        }

        $actor = $this->actor($request);
        $p = $this->projects($actor)->where('p.id', $id)->first();
        abort_unless($p !== null, 404);

        $records = $this->records($actor)->where('m.project_id', $id)->orderByDesc('m.maintenance_year')->orderByDesc('m.quarter')
            ->get(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.status', 'm.managing_engineer_id', 'm.start_date', 'e.first_name', 'e.last_name']);
        $latestYear = $records->first()?->maintenance_year;

        return $this->render('MaintenanceProjects/Show', $request, ['project' => $this->projectData($p, $actor),
            'records' => $records->map(fn (\stdClass $r): array => $this->historyData($r, $actor)),
            'recordCreateUrl' => $this->writable($actor) ? self::BASE.'/maintenance-projects/'.$id.'/records/create' : null,
            'expandedYear' => $request->integer('record_year', (int) ($latestYear ?? date('Y')))]);
    }
}
