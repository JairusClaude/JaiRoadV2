<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\BoundedDirectoryPage;
use App\Support\LiteralDirectorySearch;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
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
        $filters = ['search' => LiteralDirectorySearch::normalize($request->query('search')), 'municipality' => LiteralDirectorySearch::numericOption($request->query('municipality')), 'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->projects($actor, false)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', LiteralDirectorySearch::pattern($filters['search'])));
        if (ctype_digit($filters['municipality'])) {
            $q->where('rc.lgu_id', $filters['municipality']);
        }

        return $this->render('MaintenanceProjects/Index', $request, [
            'projects' => BoundedDirectoryPage::paginate($q->orderBy('p.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc'), $request, 12)->through(fn (\stdClass $p): array => $this->projectData($p, $actor)),
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
        $p = $id === null ? null : $this->projects($actor, false)->where('p.id', $id)->first();
        abort_if($id !== null && $p === null, 404);

        $choices = $this->coverageChoicePage($actor, $id, '', $id !== null, 1);
        $selected = $p === null ? null : $this->coverageChoiceQuery($actor)->where('rc.id', $p->road_coverage_id)->first();

        return $this->render('MaintenanceProjects/'.($id === null ? 'Create' : 'Edit'), $request, [
            'project' => $p === null ? null : $this->projectData($p, $actor),
            'coverages' => $choices['data'],
            'coveragePagination' => array_diff_key($choices, ['data' => true]),
            'selectedCoverage' => $selected === null ? null : $this->coverageChoiceData($selected, $id),
            'coverageChoiceUrl' => self::BASE.'/project-road-choices',
            'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public function coverageChoices(Request $request): JsonResponse
    {
        abort_if(self::isPreview($request), 404);
        $actor = $this->actor($request);
        $this->writer($actor);
        $v = $request->validate(['project' => ['nullable', 'integer', 'min:1'], 'page' => ['nullable', 'integer', 'min:1']]);
        $id = isset($v['project']) ? (int) $v['project'] : null;
        if ($id !== null) {
            abort_unless($this->projects($actor, false)->where('p.id', $id)->exists(), 404);
        }

        return response()->json($this->coverageChoicePage($actor, $id, LiteralDirectorySearch::normalize($request->query('search')), $request->boolean('show_assigned'), (int) ($v['page'] ?? 1)))
            ->header('Cache-Control', 'private, no-store');
    }

    public function coverageGeometry(Request $request, int $id): JsonResponse
    {
        abort_if(self::isPreview($request), 404);
        $actor = $this->actor($request);
        $this->writer($actor);
        $road = $this->roads($actor)->where('rc.id', $id)->select(['rc.geojson'])->first();
        abort_unless($road !== null, 404);

        return response()->json(['geojson' => json_decode((string) $road->geojson, true, 512, JSON_THROW_ON_ERROR)])
            ->header('Cache-Control', 'private, no-store');
    }

    /** @param  array{account_id:int,role:string,engineer_id:?int}  $actor */
    private function coverageChoiceQuery(array $actor): Builder
    {
        return $this->roads($actor)->select(['rc.id', 'rc.road_name', 'rc.kilometers', 'l.municipality_name', 'p.id as project_id', 'p.project_title']);
    }

    /** @return array<string,mixed> */
    private function coverageChoiceData(\stdClass $road, ?int $project): array
    {
        $assigned = $road->project_id !== null && ($project === null || (int) $road->project_id !== $project);

        return ['id' => (int) $road->id, 'road_name' => $road->road_name, 'municipality' => $road->municipality_name,
            'kilometers' => (string) $road->kilometers, 'assigned' => $assigned, 'assigned_project_title' => $assigned ? $road->project_title : null, 'geojson' => null];
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array{data:array<int,array<string,mixed>>,available:int,assigned:int,page:int,last_page:int}
     */
    private function coverageChoicePage(array $actor, ?int $project, string $search, bool $showAssigned, int $page): array
    {
        $query = $this->coverageChoiceQuery($actor);
        if ($search !== '') {
            $pattern = LiteralDirectorySearch::pattern($search);
            $query->where(fn (Builder $q) => $q->where('rc.road_name', 'ilike', $pattern)->orWhere('l.municipality_name', 'ilike', $pattern));
        }
        $total = (clone $query)->count();
        $availableQuery = (clone $query)->where(function (Builder $q) use ($project): void {
            $q->whereNull('p.id');
            if ($project !== null) {
                $q->orWhere('p.id', $project);
            }
        });
        $available = $availableQuery->count();
        $last = max(1, (int) ceil(($showAssigned ? $total : $available) / 30));
        $page = min($page, $last);
        $rows = ($showAssigned ? $query : $availableQuery)->orderBy('rc.road_name')->orderBy('rc.id')->forPage($page, 30)->get();

        return ['data' => $rows->map(fn (\stdClass $road): array => $this->coverageChoiceData($road, $project))->all(),
            'available' => $available, 'assigned' => $total - $available, 'page' => $page, 'last_page' => $last];
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
