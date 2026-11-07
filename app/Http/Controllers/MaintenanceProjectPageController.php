<?php

declare(strict_types=1);

namespace App\Http\Controllers;

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
        $actor = $this->actor($request);
        $filters = ['search' => $request->string('search')->toString(), 'municipality' => $request->string('municipality', 'all')->toString(), 'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->projects($actor, false)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
        if (ctype_digit($filters['municipality'])) {
            $q->where('rc.lgu_id', $filters['municipality']);
        }

        return $this->render('MaintenanceProjects/Index', $request, [
            'projects' => $q->orderBy('p.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $p): array => $this->projectData($p, $actor)),
            'municipalities' => $this->municipalities($actor), 'filters' => $filters,
            'integration' => ['ready' => true, 'message' => null], 'canCreate' => $this->writable($actor), 'canBulkDelete' => false,
        ]);
    }

    public function projectForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $p = $id === null ? null : $this->projects($actor)->where('p.id', $id)->first();
        abort_if($id !== null && $p === null, 404);

        return $this->render('MaintenanceProjects/'.($id === null ? 'Create' : 'Edit'), $request, [
            'project' => $p === null ? null : $this->projectData($p, $actor),
            'coverages' => $this->roads($actor)->where(fn (Builder $q) => $q->whereNull('p.id')->when($id !== null, fn (Builder $q) => $q->orWhere('p.id', $id)))
                ->orderBy('rc.road_name')->get()->map(fn (\stdClass $r): array => ['id' => (int) $r->id, 'road_name' => $r->road_name,
                    'municipality' => $r->municipality_name, 'kilometers' => $r->kilometers, 'assigned' => false, 'geojson' => json_decode($r->geojson, true, 512, JSON_THROW_ON_ERROR)]),
            'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public function saveProject(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        $this->operations->saveProject($request, $this->identities, $id);

        return redirect(self::BASE.'/maintenance-projects'.($id === null ? '' : '/'.$id))->with('dd_operations_status', 'Maintenance Project saved to the database.');
    }

    public function projectShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $p = $this->projects($actor)->where('p.id', $id)->first();
        abort_unless($p !== null, 404);

        return $this->render('MaintenanceProjects/Show', $request, ['project' => $this->projectData($p, $actor),
            'records' => $this->records($actor)->where('m.project_id', $id)->orderByDesc('m.maintenance_year')->orderByDesc('m.quarter')
                ->get(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.status', 'm.managing_engineer_id', 'm.start_date', 'e.first_name', 'e.last_name'])
                ->map(fn (\stdClass $r): array => $this->historyData($r, $actor)),
            'recordCreateUrl' => $this->writable($actor) ? self::BASE.'/maintenance-projects/'.$id.'/records/create' : null,
            'expandedYear' => $request->integer('record_year', (int) date('Y'))]);
    }
}
