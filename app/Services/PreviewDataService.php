<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

final class PreviewDataService
{
    private static ?string $storagePath = null;

    public static function getStoragePath(): string
    {
        if (self::$storagePath === null) {
            $dir = storage_path('app');
            if (! is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
            self::$storagePath = $dir . DIRECTORY_SEPARATOR . 'preview_store.json';
        }
        return self::$storagePath;
    }

    public static function getStore(): array
    {
        $path = self::getStoragePath();
        if (file_exists($path)) {
            $json = @file_get_contents($path);
            if ($json) {
                $data = json_decode($json, true);
                if (is_array($data) && ! empty($data['road_coverages']) && ! empty($data['maintenance_projects'])) {
                    return $data;
                }
            }
        }

        $initial = self::initialData();
        self::saveStore($initial);
        return $initial;
    }

    public static function saveStore(array $data): void
    {
        $path = self::getStoragePath();
        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    public static function resetStore(): array
    {
        $initial = self::initialData();
        self::saveStore($initial);
        return $initial;
    }

    /**
     * Common preview render wrapper.
     */
    public static function render(string $component, Request $request, array $props): Response
    {
        return Inertia::render($component, $props + [
            'canonicalFrontend' => true,
            'previewOnly' => false,
            'jairoadsIdentity' => [
                'role' => 'superadmin',
                'username' => 'UserTest',
                'name' => 'UserTest',
            ],
            'status' => $request->session()->get('dd_operations_status'),
        ]);
    }

    // ==========================================
    // ROAD COVERAGES
    // ==========================================

    public static function roadIndex(Request $request): Response
    {
        $store = self::getStore();
        $coverages = collect($store['road_coverages'] ?? []);
        $lgus = collect($store['lgus'] ?? []);

        $filters = $request->only(['search', 'municipality', 'condition', 'pavement', 'sort'])
            + ['search' => '', 'municipality' => 'all', 'condition' => 'all', 'pavement' => 'all', 'sort' => 'newest'];

        $filtered = $coverages->filter(function (array $r) use ($filters): bool {
            if (! empty($filters['search'])) {
                $term = strtolower((string) $filters['search']);
                if (strpos(strtolower($r['road_name']), $term) === false &&
                    strpos(strtolower($r['municipality_name'] ?? ''), $term) === false) {
                    return false;
                }
            }
            if ($filters['municipality'] !== 'all' && (string) $r['lgu_id'] !== (string) $filters['municipality']) {
                return false;
            }
            if ($filters['condition'] !== 'all' && strtolower($r['state_category']) !== strtolower($filters['condition'])) {
                return false;
            }
            if ($filters['pavement'] !== 'all' && strtolower($r['pavement_type']) !== strtolower($filters['pavement'])) {
                return false;
            }
            return true;
        });

        $sorted = match ($filters['sort']) {
            'name-asc' => $filtered->sortBy('road_name'),
            'name-desc' => $filtered->sortByDesc('road_name'),
            'oldest' => $filtered->sortBy('id'),
            default => $filtered->sortByDesc('id'),
        };

        $totalCoverages = $coverages->count();
        $linkedProjects = $coverages->filter(fn ($r) => ! empty($r['project_id']))->pluck('project_id')->unique()->count();
        $totalLengthKm = (float) $coverages->sum('kilometers');

        $mapCoverages = $coverages->map(fn (array $r): array => [
            'id' => (int) $r['id'],
            'road_name' => $r['road_name'],
            'municipality' => $r['municipality_name'] ?? 'Davao de Oro',
            'assigned' => ! empty($r['project_id']),
            'geojson' => is_string($r['geojson']) ? json_decode($r['geojson'], true) : $r['geojson'],
        ])->values()->all();

        $page = (int) $request->input('page', 1);
        $perPage = 12;
        $paginatedItems = $sorted->slice(($page - 1) * $perPage, $perPage)->values()->map(fn ($r) => self::formatRoadData($r));

        $paginator = new LengthAwarePaginator(
            $paginatedItems,
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        $municipalities = $lgus->map(fn ($l) => ['id' => (int) $l['id'], 'municipality_name' => $l['municipality_name']])->sortBy('municipality_name')->values();

        return self::render('RoadCoverages/Index', $request, [
            'totalCoverages' => $totalCoverages,
            'linkedProjects' => $linkedProjects,
            'totalLengthKm' => round($totalLengthKm, 2),
            'mapCoverages' => $mapCoverages,
            'coverages' => $paginator,
            'municipalities' => $municipalities,
            'filters' => $filters,
            'canEdit' => true,
            'canDelete' => true,
        ]);
    }

    public static function roadShow(Request $request, int $id): Response
    {
        $store = self::getStore();
        $road = collect($store['road_coverages'])->firstWhere('id', $id);
        abort_unless($road !== null, 404);

        $lgus = collect($store['lgus']);

        return self::render('RoadCoverages/Show', $request, [
            'coverage' => self::formatRoadData($road),
            'createdByName' => $road['created_by_name'] ?? 'Engineer Assigned',
            'associatedProject' => empty($road['project_id']) ? null : [
                'id' => (int) $road['project_id'],
                'project_title' => $road['project_title'] ?? 'Maintenance Project #' . $road['project_id'],
            ],
            'canEdit' => true,
            'canDelete' => true,
            'backUrl' => '/dd-phase3/ui/road-coverages',
            'municipalities' => $lgus->map(fn ($l) => ['id' => (int) $l['id'], 'municipality_name' => $l['municipality_name']])->values(),
        ]);
    }

    public static function roadForm(Request $request, ?int $id = null): Response
    {
        $store = self::getStore();
        $road = $id === null ? null : collect($store['road_coverages'])->firstWhere('id', $id);
        abort_if($id !== null && $road === null, 404);

        $lgus = collect($store['lgus'])->map(fn ($l) => [
            'id' => (int) $l['id'],
            'municipality_name' => $l['municipality_name'],
        ])->sortBy('municipality_name')->values();

        $engineers = collect($store['engineers'])->map(fn ($e) => [
            'id' => (int) $e['id'],
            'lgu_id' => (int) ($e['lgu_id'] ?? 1),
            'first_name' => $e['first_name'],
            'last_name' => $e['last_name'],
        ])->values();

        return self::render('RoadCoverages/' . ($id === null ? 'Create' : 'Edit'), $request, [
            'coverage' => $road === null ? null : self::formatRoadData($road),
            'municipalities' => $lgus,
            'roadCreatorChoices' => $engineers,
            'requiresCreator' => false,
            'referenceCoverages' => [],
            'referenceUrl' => '/dd-phase3/ui/map/roads',
            'mapServices' => [
                'routing' => config('jairoads_maps.routing') ?: 'https://router.project-osrm.org/route/v1/driving',
                'geocoding' => config('jairoads_maps.geocoding') ?: 'https://photon.komoot.io/api',
            ],
            'canEdit' => true,
            'cancelUrl' => '/dd-phase3/ui/road-coverages' . ($id === null ? '' : '/' . $id),
        ]);
    }

    public static function saveRoad(Request $request, ?int $id = null): RedirectResponse
    {
        $store = self::getStore();
        $coverages = $store['road_coverages'] ?? [];
        $lgus = collect($store['lgus'] ?? []);

        $lguId = (int) ($request->input('lgu_id') ?: $request->input('lgus_id') ?: 1);
        $lgu = $lgus->firstWhere('id', $lguId);
        $municipalityName = $lgu ? $lgu['municipality_name'] : 'Nabunturan';

        $geojson = $request->input('geojson');
        if (is_string($geojson)) {
            $geojson = json_decode($geojson, true);
        }

        $kilometers = (float) $request->input('kilometers', 0);
        if ($kilometers <= 0 && is_array($geojson) && ! empty($geojson['coordinates'])) {
            $coords = $geojson['coordinates'];
            $km = 0.0;
            for ($i = 0; $i < count($coords) - 1; $i++) {
                $km += self::haversineDistance($coords[$i][1], $coords[$i][0], $coords[$i + 1][1], $coords[$i + 1][0]);
            }
            $kilometers = round(max($km, 1.2), 2);
        }
        if ($kilometers <= 0) {
            $kilometers = 5.5;
        }

        if ($id !== null) {
            foreach ($coverages as &$item) {
                if ((int) $item['id'] === $id) {
                    $item['road_name'] = $request->input('road_name', $item['road_name']);
                    $item['lgu_id'] = $lguId;
                    $item['municipality_name'] = $municipalityName;
                    $item['pavement_type'] = $request->input('pavement_type', $item['pavement_type']);
                    $item['state_category'] = $request->input('state_category') ?: $request->input('road_condition') ?: $item['state_category'];
                    $item['kilometers'] = $kilometers;
                    if ($geojson) {
                        $item['geojson'] = $geojson;
                    }
                    $item['updated_at'] = now()->toIso8601String();
                    break;
                }
            }
            unset($item);
            $targetId = $id;
        } else {
            $maxId = empty($coverages) ? 0 : max(array_column($coverages, 'id'));
            $newId = $maxId + 1;
            $newRecord = [
                'id' => $newId,
                'road_name' => $request->input('road_name', 'New Road Coverage #' . $newId),
                'lgu_id' => $lguId,
                'municipality_name' => $municipalityName,
                'pavement_type' => $request->input('pavement_type', 'Concrete'),
                'state_category' => $request->input('state_category') ?: $request->input('road_condition') ?: 'Good',
                'kilometers' => $kilometers,
                'geojson' => $geojson ?: [
                    'type' => 'LineString',
                    'coordinates' => [
                        [125.9614, 7.6033],
                        [125.9720, 7.6250],
                    ],
                ],
                'created_by' => 1,
                'created_by_name' => 'UserTest',
                'project_id' => null,
                'project_title' => null,
                'created_at' => now()->toIso8601String(),
                'updated_at' => now()->toIso8601String(),
            ];
            $coverages[] = $newRecord;
            $targetId = $newId;
        }

        $store['road_coverages'] = $coverages;
        self::saveStore($store);

        return redirect('/dd-phase3/ui/road-coverages' . ($id === null ? '' : '/' . $targetId))
            ->with('dd_operations_status', 'Road coverage saved successfully (Preview Mode).');
    }

    public static function deleteRoad(Request $request, int $id): RedirectResponse
    {
        $store = self::getStore();
        $coverages = $store['road_coverages'] ?? [];
        $store['road_coverages'] = array_values(array_filter($coverages, fn ($r) => (int) $r['id'] !== $id));
        self::saveStore($store);

        return redirect('/dd-phase3/ui/road-coverages')
            ->with('dd_operations_status', 'Road coverage deleted successfully (Preview Mode).');
    }

    public static function bulkDeleteRoad(Request $request): RedirectResponse
    {
        $ids = (array) $request->input('ids', []);
        $intIds = array_map('intval', $ids);
        $store = self::getStore();
        $coverages = $store['road_coverages'] ?? [];
        $store['road_coverages'] = array_values(array_filter($coverages, fn ($r) => ! in_array((int) $r['id'], $intIds, true)));
        self::saveStore($store);

        return redirect('/dd-phase3/ui/road-coverages')
            ->with('dd_operations_status', 'Selected road coverages deleted successfully (Preview Mode).');
    }

    public static function roadReferences(Request $request): JsonResponse
    {
        $store = self::getStore();
        $coverages = collect($store['road_coverages'] ?? []);

        $data = $coverages->map(fn ($r) => [
            'id' => (int) $r['id'],
            'road_name' => $r['road_name'],
            'lgus_id' => (int) $r['lgu_id'],
            'kilometers' => (float) $r['kilometers'],
            'pavement_type' => $r['pavement_type'],
            'state_category' => $r['state_category'],
            'geojson' => is_string($r['geojson']) ? json_decode($r['geojson'], true) : $r['geojson'],
        ])->values()->all();

        return response()->json([
            'data' => $data,
            'next_cursor' => null,
        ]);
    }

    private static function formatRoadData(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'road_name' => $row['road_name'],
            'lgus_id' => (int) $row['lgu_id'],
            'lgu' => [
                'id' => (int) $row['lgu_id'],
                'municipality_name' => $row['municipality_name'] ?? 'Davao de Oro',
            ],
            'kilometers' => (float) $row['kilometers'],
            'pavement_type' => $row['pavement_type'],
            'state_category' => $row['state_category'],
            'geojson' => is_string($row['geojson']) ? json_decode($row['geojson'], true) : $row['geojson'],
            'created_by' => (int) ($row['created_by'] ?? 1),
            'created_at' => $row['created_at'] ?? now()->toIso8601String(),
            'updated_at' => $row['updated_at'] ?? now()->toIso8601String(),
            'has_projects' => ! empty($row['project_id']),
            'project_title' => $row['project_title'] ?? null,
        ];
    }

    // ==========================================
    // LGUs
    // ==========================================

    public static function lguIndex(Request $request): Response
    {
        $store = self::getStore();
        $lgus = collect($store['lgus'] ?? []);
        $coverages = collect($store['road_coverages'] ?? []);
        $engineers = collect($store['engineers'] ?? []);

        $search = trim((string) $request->query('search', ''));
        $province = trim((string) $request->query('province', ''));
        $region = trim((string) $request->query('region', ''));
        $sort = strtolower((string) $request->query('sort', 'asc')) === 'desc' ? 'desc' : 'asc';

        $filtered = $lgus->filter(function ($l) use ($search, $province, $region): bool {
            if ($search !== '') {
                $term = strtolower($search);
                $haystack = strtolower(implode(' ', [
                    $l['municipality_name'] ?? '',
                    $l['province'] ?? '',
                    $l['region'] ?? '',
                    $l['mayor_first_name'] ?? '',
                    $l['mayor_last_name'] ?? '',
                ]));
                if (strpos($haystack, $term) === false) {
                    return false;
                }
            }
            if ($province !== '' && $province !== 'all' && ($l['province'] ?? '') !== $province) {
                return false;
            }
            if ($region !== '' && $region !== 'all' && ($l['region'] ?? '') !== $region) {
                return false;
            }
            return true;
        });

        $sorted = $sort === 'desc'
            ? $filtered->sortByDesc('municipality_name')
            : $filtered->sortBy('municipality_name');

        $page = (int) $request->input('page', 1);
        $perPage = 10;
        $items = $sorted->slice(($page - 1) * $perPage, $perPage)->values()->map(function ($lgu) use ($coverages, $engineers) {
            $id = (int) $lgu['id'];
            $roadCount = $coverages->where('lgu_id', $id)->count();
            $assignmentCount = $engineers->where('lgu_id', $id)->count();

            return [
                'id' => $id,
                'municipality_name' => $lgu['municipality_name'],
                'province' => $lgu['province'] ?? 'Davao de Oro',
                'region' => $lgu['region'] ?? 'XI',
                'mayor_first_name' => $lgu['mayor_first_name'] ?? '',
                'mayor_middle_name' => $lgu['mayor_middle_name'] ?? '',
                'mayor_last_name' => $lgu['mayor_last_name'] ?? '',
                'deletion_check' => [
                    'available' => true,
                    'road_coverages' => $roadCount,
                    'engineer_assignments' => $assignmentCount,
                ],
            ];
        })->all();

        $provinces = $lgus->pluck('province')->filter()->unique()->sort()->values()->all();
        $regions = $lgus->pluck('region')->filter()->unique()->sort()->values()->all();

        return self::render('LGUs/Index', $request, [
            'totalMunicipalities' => $lgus->count(),
            'totalRoadCoverages' => $coverages->count(),
            'totalEngineerAssignments' => $engineers->count(),
            'lgus' => [
                'data' => $items,
                'total' => $sorted->count(),
                'current_page' => $page,
                'last_page' => (int) ceil(max($sorted->count(), 1) / $perPage),
                'from' => ($page - 1) * $perPage + 1,
                'to' => min($page * $perPage, $sorted->count()),
            ],
            'filters' => [
                'search' => $search,
                'province' => $province,
                'region' => $region,
                'sort' => $sort,
            ],
            'provinces' => $provinces,
            'regions' => $regions,
            'lguPermissions' => [
                'can_edit' => true,
                'can_delete' => true,
            ],
            'canBulkDelete' => true,
            'canDelete' => true,
        ]);
    }

    public static function lguShow(Request $request, int $id): Response
    {
        $store = self::getStore();
        $lgu = collect($store['lgus'])->firstWhere('id', $id);
        abort_unless($lgu !== null, 404);

        $roads = collect($store['road_coverages'] ?? [])->where('lgu_id', $id)->values();
        $assignments = collect($store['engineers'] ?? [])->where('lgu_id', $id)->values();

        $lguDetail = array_merge($lgu, [
            'id' => (int) $lgu['id'],
            'deletion_check' => [
                'available' => true,
                'road_coverages' => $roads->count(),
                'engineer_assignments' => $assignments->count(),
            ],
        ]);

        $roadCoverages = $roads->map(fn ($r): array => [
            'id' => (int) $r['id'],
            'road_name' => $r['road_name'] ?? 'Road Coverage',
            'kilometers' => $r['kilometers'] ?? 0,
            'pavement_type' => $r['pavement_type'] ?? 'Concrete',
            'state_category' => $r['state_category'] ?? 'Good',
        ])->all();

        $assignedEngineers = $assignments->map(fn ($e): array => [
            'id' => (int) $e['id'],
            'first_name' => $e['first_name'] ?? 'Engineer',
            'last_name' => $e['last_name'] ?? 'User',
            'rank' => $e['rank'] ?? 'Municipal Engineer',
        ])->all();

        return self::render('LGUs/Show', $request, [
            'lgu' => $lguDetail,
            'roadCoverages' => $roadCoverages,
            'assignedEngineers' => $assignedEngineers,
            'relationshipDataAvailable' => true,
            'directoryUrl' => '/dd-phase3/ui/lgus',
            'lguPermissions' => [
                'can_edit' => true,
                'can_delete' => true,
            ],
        ]);
    }

    public static function lguForm(Request $request, ?int $id = null): Response
    {
        $store = self::getStore();
        $lgu = $id === null ? null : collect($store['lgus'])->firstWhere('id', $id);
        abort_if($id !== null && $lgu === null, 404);

        return self::render('LGUs/' . ($id === null ? 'Create' : 'Edit'), $request, [
            'lgu' => $lgu,
            'canEdit' => true,
            'backUrl' => '/dd-phase3/ui/lgus',
        ]);
    }

    public static function saveLgu(Request $request, ?int $id = null): RedirectResponse
    {
        $store = self::getStore();
        $lgus = $store['lgus'] ?? [];

        if ($id !== null) {
            foreach ($lgus as &$item) {
                if ((int) $item['id'] === $id) {
                    $item['municipality_name'] = $request->input('municipality_name', $item['municipality_name']);
                    $item['province'] = $request->input('province', $item['province'] ?? 'Davao de Oro');
                    $item['region'] = $request->input('region', $item['region'] ?? 'XI');
                    $item['mayor_first_name'] = $request->input('mayor_first_name', $item['mayor_first_name'] ?? '');
                    $item['mayor_middle_name'] = $request->input('mayor_middle_name', $item['mayor_middle_name'] ?? '');
                    $item['mayor_last_name'] = $request->input('mayor_last_name', $item['mayor_last_name'] ?? '');
                    $item['contact_no'] = $request->input('contact_no', $item['contact_no'] ?? '');
                    break;
                }
            }
            unset($item);
        } else {
            $maxId = empty($lgus) ? 0 : max(array_column($lgus, 'id'));
            $newId = $maxId + 1;
            $lgus[] = [
                'id' => $newId,
                'municipality_name' => $request->input('municipality_name', 'New LGU #' . $newId),
                'province' => $request->input('province', 'Davao de Oro'),
                'region' => $request->input('region', 'XI'),
                'mayor_first_name' => $request->input('mayor_first_name', ''),
                'mayor_middle_name' => $request->input('mayor_middle_name', ''),
                'mayor_last_name' => $request->input('mayor_last_name', ''),
                'contact_no' => $request->input('contact_no', ''),
            ];
        }

        $store['lgus'] = $lgus;
        self::saveStore($store);

        return redirect('/dd-phase3/ui/lgus')->with('dd_operations_status', 'LGU saved successfully (Preview Mode).');
    }

    public static function deleteLgu(Request $request, int $id): RedirectResponse
    {
        $store = self::getStore();
        $lgus = $store['lgus'] ?? [];
        $store['lgus'] = array_values(array_filter($lgus, fn ($l) => (int) $l['id'] !== $id));
        self::saveStore($store);

        return redirect('/dd-phase3/ui/lgus')->with('dd_operations_status', 'LGU deleted successfully (Preview Mode).');
    }

    public static function bulkDestroyLgu(Request $request): RedirectResponse
    {
        $ids = (array) $request->input('ids', []);
        $intIds = array_map('intval', $ids);
        $store = self::getStore();
        $lgus = $store['lgus'] ?? [];
        $store['lgus'] = array_values(array_filter($lgus, fn ($l) => ! in_array((int) $l['id'], $intIds, true)));
        self::saveStore($store);

        return redirect('/dd-phase3/ui/lgus')->with('dd_operations_status', 'Selected LGUs deleted successfully (Preview Mode).');
    }

    // ==========================================
    // MAINTENANCE PROJECTS
    // ==========================================

    public static function projectIndex(Request $request): Response
    {
        $store = self::getStore();
        $projects = collect($store['maintenance_projects'] ?? []);
        $lgus = collect($store['lgus'] ?? []);

        $filters = [
            'search' => (string) $request->input('search', ''),
            'municipality' => (string) $request->input('municipality', 'all'),
            'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest',
        ];

        $filtered = $projects->filter(function ($p) use ($filters): bool {
            if ($filters['search'] !== '') {
                $term = strtolower($filters['search']);
                if (strpos(strtolower($p['project_title']), $term) === false &&
                    strpos(strtolower($p['municipality_name'] ?? ''), $term) === false) {
                    return false;
                }
            }
            if ($filters['municipality'] !== 'all' && (string) ($p['lgu_id'] ?? '') !== (string) $filters['municipality']) {
                return false;
            }
            return true;
        });

        $sorted = $filters['sort'] === 'oldest' ? $filtered->sortBy('id') : $filtered->sortByDesc('id');

        $page = (int) $request->input('page', 1);
        $perPage = 12;
        $paginatedItems = $sorted->slice(($page - 1) * $perPage, $perPage)->values()->map(fn ($p) => self::formatProjectData($p));

        $paginator = new LengthAwarePaginator(
            $paginatedItems,
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return self::render('MaintenanceProjects/Index', $request, [
            'projects' => $paginator,
            'municipalities' => $lgus->map(fn ($l) => ['id' => (int) $l['id'], 'municipality_name' => $l['municipality_name']])->values(),
            'filters' => $filters,
            'integration' => ['ready' => true, 'message' => null],
            'canCreate' => true,
            'canBulkDelete' => true,
        ]);
    }

    public static function projectShow(Request $request, int $id): Response
    {
        $store = self::getStore();
        $p = collect($store['maintenance_projects'])->firstWhere('id', $id);
        abort_unless($p !== null, 404);

        $records = collect($store['maintenance_records'])->where('project_id', $id)->values()->map(fn ($r) => self::formatRecordData($r));

        return self::render('MaintenanceProjects/Show', $request, [
            'project' => self::formatProjectData($p),
            'records' => $records,
            'recordCreateUrl' => '/dd-phase3/ui/maintenance-projects/' . $id . '/records/create',
            'expandedYear' => (int) date('Y'),
        ]);
    }

    public static function projectForm(Request $request, ?int $id = null): Response
    {
        $store = self::getStore();
        $p = $id === null ? null : collect($store['maintenance_projects'])->firstWhere('id', $id);
        $coverages = collect($store['road_coverages'])->map(fn ($r) => [
            'id' => (int) $r['id'],
            'road_name' => $r['road_name'],
            'municipality' => $r['municipality_name'] ?? 'Nabunturan',
            'kilometers' => (float) $r['kilometers'],
            'assigned' => ! empty($r['project_id']),
            'geojson' => is_string($r['geojson']) ? json_decode($r['geojson'], true) : $r['geojson'],
        ])->values();

        return self::render('MaintenanceProjects/' . ($id === null ? 'Create' : 'Edit'), $request, [
            'project' => $p === null ? null : self::formatProjectData($p),
            'coverages' => $coverages,
            'integration' => ['ready' => true, 'message' => null],
            'canEdit' => true,
            'backUrl' => '/dd-phase3/ui/maintenance-projects',
        ]);
    }

    public static function saveProject(Request $request, ?int $id = null): RedirectResponse
    {
        $store = self::getStore();
        $projects = $store['maintenance_projects'] ?? [];
        $coverages = collect($store['road_coverages'] ?? []);

        $coverageId = (int) $request->input('road_coverage_id', 1);
        $coverage = $coverages->firstWhere('id', $coverageId);

        if ($id !== null) {
            foreach ($projects as &$item) {
                if ((int) $item['id'] === $id) {
                    $item['project_title'] = $request->input('project_title', $item['project_title']);
                    $item['description'] = $request->input('description', $item['description']);
                    $item['road_coverage_id'] = $coverageId;
                    if ($coverage) {
                        $item['road_name'] = $coverage['road_name'];
                        $item['lgu_id'] = $coverage['lgu_id'];
                        $item['municipality_name'] = $coverage['municipality_name'];
                        $item['geojson'] = $coverage['geojson'] ?? null;
                    }
                    break;
                }
            }
            unset($item);
            $targetId = $id;
        } else {
            $maxId = empty($projects) ? 0 : max(array_column($projects, 'id'));
            $newId = $maxId + 1;
            $projects[] = [
                'id' => $newId,
                'project_title' => $request->input('project_title', 'Maintenance Project #' . $newId),
                'description' => $request->input('description', 'Standard road maintenance project.'),
                'road_coverage_id' => $coverageId,
                'road_name' => $coverage ? $coverage['road_name'] : 'Road Coverage',
                'lgu_id' => $coverage ? $coverage['lgu_id'] : 1,
                'municipality_name' => $coverage ? $coverage['municipality_name'] : 'Nabunturan',
                'status' => 'Ongoing',
                'record_count' => 0,
                'created_by' => 'UserTest',
                'created_at' => now()->toIso8601String(),
                'updated_at' => now()->toIso8601String(),
                'geojson' => $coverage ? ($coverage['geojson'] ?? null) : null,
            ];
            $targetId = $newId;
        }

        $store['maintenance_projects'] = $projects;
        self::saveStore($store);

        return redirect('/dd-phase3/ui/maintenance-projects/' . $targetId)->with('dd_operations_status', 'Maintenance Project saved successfully (Preview Mode).');
    }

    private static function formatProjectData(array $row): array
    {
        $store = self::getStore();
        $coverages = collect($store['road_coverages'] ?? []);
        $coverageId = (int) ($row['road_coverage_id'] ?? 0);
        $coverage = $coverages->firstWhere('id', $coverageId);
        $geojson = $row['geojson'] ?? ($coverage['geojson'] ?? null);
        if (is_string($geojson)) {
            $geojson = json_decode($geojson, true);
        }

        return [
            'id' => (int) $row['id'],
            'project_title' => $row['project_title'],
            'description' => $row['description'] ?? 'Quarterly road maintenance project.',
            'road_coverage_id' => $coverageId ?: 1,
            'road_name' => $row['road_name'] ?? ($coverage['road_name'] ?? 'Corridor'),
            'municipality' => $row['municipality_name'] ?? ($coverage['municipality_name'] ?? 'Nabunturan'),
            'created_by' => $row['created_by'] ?? 'UserTest',
            'created_at' => $row['created_at'] ?? '2026-01-15T00:00:00Z',
            'updated_at' => $row['updated_at'] ?? '2026-01-15T00:00:00Z',
            'maintenance_records_count' => (int) ($row['record_count'] ?? 1),
            'can_edit' => true,
            'can_delete' => true,
            'geojson' => $geojson,
        ];
    }

    // ==========================================
    // MAINTENANCE RECORDS
    // ==========================================

    public static function recordIndex(Request $request): Response
    {
        $store = self::getStore();
        $records = collect($store['maintenance_records'] ?? []);
        $projects = collect($store['maintenance_projects'] ?? []);
        $lgus = collect($store['lgus'] ?? []);

        $filters = [
            'search' => (string) $request->input('search', ''),
            'municipality' => (string) $request->input('municipality', 'all'),
            'year' => (string) $request->input('year', 'all'),
            'quarter' => (string) $request->input('quarter', 'all'),
            'status' => (string) $request->input('status', 'all'),
            'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest',
        ];

        $filtered = $records->filter(function ($r) use ($filters): bool {
            if ($filters['search'] !== '') {
                $term = strtolower($filters['search']);
                if (strpos(strtolower($r['project_title'] ?? ''), $term) === false &&
                    strpos(strtolower($r['managing_engineer_name'] ?? ''), $term) === false) {
                    return false;
                }
            }
            if ($filters['municipality'] !== 'all' && (string) ($r['lgu_id'] ?? '') !== (string) $filters['municipality']) {
                return false;
            }
            if ($filters['year'] !== 'all' && (string) ($r['maintenance_year'] ?? '') !== (string) $filters['year']) {
                return false;
            }
            if ($filters['quarter'] !== 'all' && strtolower($r['quarter'] ?? '') !== strtolower($filters['quarter'])) {
                return false;
            }
            if ($filters['status'] !== 'all' && strtolower($r['status'] ?? '') !== strtolower($filters['status'])) {
                return false;
            }
            return true;
        });

        $sorted = $filters['sort'] === 'oldest' ? $filtered->sortBy('id') : $filtered->sortByDesc('id');

        $page = (int) $request->input('page', 1);
        $perPage = 12;
        $paginatedItems = $sorted->slice(($page - 1) * $perPage, $perPage)->values()->map(fn ($r) => self::formatRecordData($r));

        $paginator = new LengthAwarePaginator(
            $paginatedItems,
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        $projectChoices = $projects->map(fn ($p) => [
            'id' => (int) $p['id'],
            'project_title' => $p['project_title'],
            'municipality' => $p['municipality_name'] ?? 'Nabunturan',
        ])->sortBy('project_title')->values();

        $municipalities = $lgus->map(fn ($l) => [
            'value' => (string) $l['id'],
            'label' => $l['municipality_name'],
        ])->values();

        $years = [2026, 2025, 2024];

        return self::render('MaintenanceRecords/Index', $request, [
            'totalProjects' => $projects->count(),
            'totalRecords' => $records->count(),
            'completedRoads' => $records->filter(fn ($r) => strtolower($r['status'] ?? '') === 'completed')->count(),
            'ongoingRoads' => $records->filter(fn ($r) => in_array(strtolower($r['status'] ?? ''), ['ongoing', 'in progress'], true))->count(),
            'records' => $paginator,
            'projects' => $projectChoices,
            'municipalities' => $municipalities,
            'years' => $years,
            'historyUrl' => null,
            'filters' => $filters,
            'canCreate' => true,
            'canDelete' => true,
            'canBulkDelete' => true,
            'integration' => ['ready' => true, 'message' => null],
        ]);
    }

    public static function recordCreate(Request $request): Response
    {
        $store = self::getStore();
        $projects = collect($store['maintenance_projects'] ?? []);
        $engineers = collect($store['engineers'] ?? []);

        $byProject = [];
        foreach ($projects as $p) {
            $byProject[(int) $p['id']] = $engineers->where('lgu_id', (int) ($p['lgu_id'] ?? 1))->map(fn ($e) => [
                'id' => (int) $e['id'],
                'first_name' => $e['first_name'],
                'last_name' => $e['last_name'],
            ])->values()->all();
        }

        return self::render('MaintenanceProjects/Records/Create', $request, [
            'duplicatePeriod' => false,
            'projects' => $projects->map(fn ($p) => [
                'id' => (int) $p['id'],
                'project_title' => $p['project_title'],
                'lgu_id' => (int) ($p['lgu_id'] ?? 1),
                'municipality_name' => $p['municipality_name'] ?? 'Nabunturan',
            ])->values(),
            'engineers' => [],
            'managerChoicesByProject' => $byProject,
            'records' => collect($store['maintenance_records'])->map(fn ($r) => [
                'id' => (int) $r['id'],
                'project_id' => (int) $r['project_id'],
                'maintenance_year' => (int) ($r['maintenance_year'] ?? 2026),
                'quarter' => $r['quarter'],
            ])->values(),
            'canWrite' => true,
            'cancelUrl' => '/dd-phase3/ui/maintenance-records',
        ]);
    }

    public static function recordShow(Request $request, int $project, int $id): Response
    {
        $store = self::getStore();
        $p = collect($store['maintenance_projects'])->firstWhere('id', $project) ?? [
            'id' => $project,
            'project_title' => 'Project Maintenance #' . $project,
            'municipality_name' => 'Nabunturan',
        ];
        $r = collect($store['maintenance_records'])->firstWhere('id', $id);
        abort_unless($r !== null, 404);

        $updates = collect($store['monthly_updates'] ?? [])->where('maintenance_id', $id)->values()->map(fn ($u) => self::formatUpdateData($u));
        $documents = collect($store['maintenance_documents'] ?? [])->where('maintenance_id', $id)->values()->map(fn ($d) => self::formatDocumentData($d));

        return self::render('MaintenanceProjects/Records/Show', $request, [
            'project' => [
                'id' => (int) $p['id'],
                'project_title' => $p['project_title'],
                'municipality_name' => $p['municipality_name'] ?? 'Nabunturan',
            ],
            'record' => self::formatRecordData($r),
            'monthlyUpdateCreateUrl' => '/dd-phase3/ui/monthly-updates/create?maintenance_id=' . $id,
            'documents' => $documents,
            'updates' => $updates,
            'canWrite' => true,
            'canReassign' => false,
            'canUnassign' => false,
            'managerChoices' => [],
        ]);
    }

    public static function recordForm(Request $request, int $project, ?int $id = null): Response
    {
        $store = self::getStore();
        $p = collect($store['maintenance_projects'])->firstWhere('id', $project);
        abort_unless($p !== null, 404);

        $r = $id === null ? null : collect($store['maintenance_records'])->firstWhere('id', $id);
        $engineers = collect($store['engineers'])->map(fn ($e) => [
            'id' => (int) $e['id'],
            'first_name' => $e['first_name'],
            'last_name' => $e['last_name'],
        ])->values();

        return self::render('MaintenanceProjects/Records/' . ($id === null ? 'Create' : 'Edit'), $request, [
            'duplicatePeriod' => false,
            'project' => [
                'id' => (int) $p['id'],
                'project_title' => $p['project_title'],
                'lgu_id' => (int) ($p['lgu_id'] ?? 1),
                'municipality_name' => $p['municipality_name'] ?? 'Nabunturan',
            ],
            'engineers' => $engineers,
            'records' => collect($store['maintenance_records'])->where('project_id', $project)->values(),
            'record' => $r === null ? null : self::formatRecordData($r),
            'canWrite' => true,
            'submitUrl' => '/dd-phase3/ui/maintenance-projects/' . $project . '/records' . ($id === null ? '' : '/' . $id),
            'cancelUrl' => '/dd-phase3/ui/maintenance-projects/' . $project . ($id === null ? '' : '/records/' . $id),
        ]);
    }

    public static function saveRecord(Request $request, int $project, ?int $id = null): RedirectResponse
    {
        $store = self::getStore();
        $records = $store['maintenance_records'] ?? [];
        $projects = collect($store['maintenance_projects'] ?? []);
        $p = $projects->firstWhere('id', $project);

        if ($id !== null) {
            foreach ($records as &$item) {
                if ((int) $item['id'] === $id) {
                    $item['maintenance_year'] = (int) $request->input('maintenance_year', $item['maintenance_year']);
                    $item['quarter'] = $request->input('quarter', $item['quarter']);
                    $item['status'] = $request->input('status', $item['status'] ?? 'In Progress');
                    $item['description'] = $request->input('description', $item['description'] ?? '');
                    break;
                }
            }
            unset($item);
            $targetId = $id;
        } else {
            $maxId = empty($records) ? 0 : max(array_column($records, 'id'));
            $newId = $maxId + 1;
            $newRecord = [
                'id' => $newId,
                'project_id' => $project,
                'project_title' => $p ? $p['project_title'] : 'Project Maintenance #' . $project,
                'municipality_name' => $p ? ($p['municipality_name'] ?? 'Nabunturan') : 'Nabunturan',
                'maintenance_year' => (int) $request->input('maintenance_year', 2026),
                'quarter' => $request->input('quarter', 'Q2'),
                'status' => $request->input('status', 'In Progress'),
                'managing_engineer_name' => 'gav pol',
                'start_date' => $request->input('start_date', '2026-11-18'),
                'completion_date' => $request->input('completion_date'),
                'estimated_duration_days' => (int) $request->input('estimated_duration', 90),
                'description' => $request->input('description', 'Maintenance operation record.'),
                'created_by' => 'UserTest',
                'created_at' => now()->toIso8601String(),
                'updated_at' => now()->toIso8601String(),
            ];
            $records[] = $newRecord;
            $targetId = $newId;
        }

        $store['maintenance_records'] = $records;
        self::saveStore($store);

        return redirect('/dd-phase3/ui/maintenance-projects/' . $project . '/records/' . $targetId)
            ->with('dd_operations_status', 'Maintenance record saved successfully (Preview Mode).');
    }

    public static function deleteRecord(Request $request, int $id): RedirectResponse
    {
        $store = self::getStore();
        $records = $store['maintenance_records'] ?? [];
        $store['maintenance_records'] = array_values(array_filter($records, fn ($r) => (int) $r['id'] !== $id));
        self::saveStore($store);

        return redirect('/dd-phase3/ui/maintenance-records')
            ->with('dd_operations_status', 'Maintenance record deleted successfully (Preview Mode).');
    }

    public static function bulkDeleteRecord(Request $request): RedirectResponse
    {
        $ids = (array) $request->input('record_ids', $request->input('ids', []));
        $intIds = array_map('intval', $ids);
        $store = self::getStore();
        $records = $store['maintenance_records'] ?? [];
        $store['maintenance_records'] = array_values(array_filter($records, fn ($r) => ! in_array((int) $r['id'], $intIds, true)));
        self::saveStore($store);

        return redirect('/dd-phase3/ui/maintenance-records')
            ->with('dd_operations_status', 'Selected maintenance records deleted successfully (Preview Mode).');
    }

    private static function formatRecordData(array $row): array
    {
        $id = (int) $row['id'];
        $projectId = (int) ($row['project_id'] ?? 1);
        $url = '/dd-phase3/ui/maintenance-projects/' . $projectId . '/records/' . $id;

        return [
            'id' => $id,
            'project_id' => $projectId,
            'year' => (int) ($row['maintenance_year'] ?? 2026),
            'quarter' => $row['quarter'] ?? 'Q1',
            'status' => $row['status'] ?? 'In Progress',
            'engineers_id' => 1,
            'managing_engineer' => [
                'id' => 1,
                'first_name' => 'Gav',
                'last_name' => 'Pol',
            ],
            'start_date' => $row['start_date'] ?? '2026-11-18',
            'complete_date' => $row['completion_date'] ?? null,
            'estimated_duration_days' => (int) ($row['estimated_duration_days'] ?? 90),
            'description' => $row['description'] ?? 'No description provided.',
            'created_by' => $row['created_by'] ?? 'UserTest',
            'created_at' => $row['created_at'] ?? '2026-11-09T14:58:00Z',
            'updated_at' => $row['updated_at'] ?? '2026-11-09T14:58:00Z',
            'details_url' => $url,
            'edit_url' => $url . '/edit',
            'delete_url' => '/dd-phase3/ui/maintenance-records/' . $id,
            'can_delete' => true,
            'project' => [
                'id' => $projectId,
                'project_title' => $row['project_title'] ?? 'Project Maintenance Antutu',
                'municipality' => $row['municipality_name'] ?? 'Nabunturan',
            ],
        ];
    }

    // ==========================================
    // MONTHLY UPDATES
    // ==========================================

    public static function updateIndex(Request $request): Response
    {
        $store = self::getStore();
        $updates = collect($store['monthly_updates'] ?? []);
        $projects = collect($store['maintenance_projects'] ?? []);

        $filters = [
            'search' => (string) $request->input('search', ''),
            'project' => (string) $request->input('project', 'all'),
            'year' => (string) $request->input('year', 'all'),
            'sort' => in_array($request->query('sort'), ['newest', 'oldest', 'modified'], true) ? $request->query('sort') : 'newest',
        ];

        $filtered = $updates->filter(function ($u) use ($filters): bool {
            if ($filters['search'] !== '') {
                $term = strtolower($filters['search']);
                if (strpos(strtolower($u['project_title'] ?? ''), $term) === false &&
                    strpos(strtolower($u['summary'] ?? ''), $term) === false) {
                    return false;
                }
            }
            if ($filters['project'] !== 'all' && (string) ($u['project_id'] ?? '') !== (string) $filters['project']) {
                return false;
            }
            return true;
        });

        $sorted = $filters['sort'] === 'oldest' ? $filtered->sortBy('id') : $filtered->sortByDesc('id');

        $page = (int) $request->input('page', 1);
        $perPage = 12;
        $paginatedItems = $sorted->slice(($page - 1) * $perPage, $perPage)->values()->map(fn ($u) => self::formatUpdateData($u));

        $paginator = new LengthAwarePaginator(
            $paginatedItems,
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        $currentMonth = date('Y-m');
        $thisMonthCount = $updates->filter(fn ($u) => str_starts_with($u['update_month'] ?? '', $currentMonth))->count();
        if ($thisMonthCount === 0 && $updates->isNotEmpty()) {
            $latestMonth = $updates->max('update_month');
            $thisMonthCount = $updates->filter(fn ($u) => ($u['update_month'] ?? '') === $latestMonth)->count();
        }

        return self::render('MonthlyUpdates/Index', $request, [
            'totalReports' => $updates->count(),
            'reportsThisMonth' => $thisMonthCount,
            'updates' => $paginator,
            'projects' => $projects->map(fn ($p) => ['id' => (int) $p['id'], 'project_title' => $p['project_title']])->values(),
            'years' => [2026, 2025],
            'filters' => $filters,
            'canWrite' => true,
            'canDelete' => true,
            'canBulkDelete' => true,
        ]);
    }

    private static function formatUpdateData(array $row): array
    {
        $id = (int) $row['id'];
        $maintenanceId = (int) ($row['maintenance_id'] ?? 3);
        $projectId = (int) ($row['project_id'] ?? 1);

        return [
            'id' => $id,
            'maintenance_id' => $maintenanceId,
            'update_month' => $row['update_month'] ?? '2026-07',
            'progress_percentage' => (float) ($row['progress_percentage'] ?? 0),
            'summary_of_text_reports' => $row['summary'] ?? 'Initial mobilization and equipment setup.',
            'created_by' => $row['created_by'] ?? 'UserTest',
            'created_at' => $row['created_at'] ?? '2026-07-01T00:00:00Z',
            'updated_at' => $row['updated_at'] ?? '2026-07-01T00:00:00Z',
            'project' => [
                'id' => $projectId,
                'project_title' => $row['project_title'] ?? 'Project Maintenance Antutu',
            ],
            'record' => [
                'id' => $maintenanceId,
                'year' => 2026,
                'quarter' => 'Q2',
            ],
            'media_count' => (int) ($row['media_count'] ?? 0),
            'can_edit' => true,
            'photo_count' => (int) ($row['photo_count'] ?? 0),
            'video_count' => (int) ($row['video_count'] ?? 0),
            'other_count' => 0,
        ];
    }

    public static function updateShow(Request $request, int $id): Response
    {
        $store = self::getStore();
        $updates = collect($store['monthly_updates'] ?? []);
        $u = $updates->firstWhere('id', $id) ?? $updates->first();
        abort_unless($u !== null, 404);

        $updateData = self::formatUpdateData($u);

        return self::render('MonthlyUpdates/Show', $request, [
            'update' => $updateData,
            'media' => [],
            'canWrite' => true,
            'canUploadMedia' => false,
            'backUrl' => '/dd-phase3/ui/monthly-updates',
            'backLabel' => 'Monthly Updates',
            'directoryUrl' => '/dd-phase3/ui/monthly-updates',
        ]);
    }

    public static function updateForm(Request $request, ?int $id = null): Response
    {
        $store = self::getStore();
        $updates = collect($store['monthly_updates'] ?? []);
        $projects = collect($store['maintenance_projects'] ?? []);
        $records = collect($store['maintenance_records'] ?? []);

        $u = $id !== null ? ($updates->firstWhere('id', $id) ?? $updates->first()) : null;

        return self::render('MonthlyUpdates/Create', $request, [
            'update' => $u ? self::formatUpdateData($u) : null,
            'media' => [],
            'projects' => $projects->map(fn ($p) => ['id' => (int) $p['id'], 'project_title' => $p['project_title']])->values(),
            'records' => $records->map(fn ($r) => ['id' => (int) $r['id'], 'project_id' => (int) ($r['project_id'] ?? 1), 'quarter' => $r['quarter'] ?? 'Q1', 'year' => (int) ($r['year'] ?? 2026)])->values(),
            'existingUpdates' => [],
            'contextRecordId' => null,
            'project' => null,
            'record' => null,
            'submitUrl' => '/dd-phase3/ui/monthly-updates' . ($id === null ? '' : '/' . $id),
            'cancelUrl' => '/dd-phase3/ui/monthly-updates' . ($id === null ? '' : '/' . $id),
        ]);
    }

    // ==========================================
    // MAINTENANCE DOCUMENTS
    // ==========================================

    public static function documentIndex(Request $request): Response
    {
        $store = self::getStore();
        $documents = collect($store['maintenance_documents'] ?? []);
        $projects = collect($store['maintenance_projects'] ?? []);

        $filters = [
            'search' => (string) $request->input('search', ''),
            'project' => (string) $request->input('project', 'all'),
            'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest',
        ];

        $filtered = $documents->filter(function ($d) use ($filters): bool {
            if ($filters['search'] !== '') {
                $term = strtolower($filters['search']);
                if (strpos(strtolower($d['title'] ?? ''), $term) === false &&
                    strpos(strtolower($d['project_title'] ?? ''), $term) === false) {
                    return false;
                }
            }
            if ($filters['project'] !== 'all' && (string) ($d['project_id'] ?? '') !== (string) $filters['project']) {
                return false;
            }
            return true;
        });

        $sorted = $filters['sort'] === 'oldest' ? $filtered->sortBy('id') : $filtered->sortByDesc('id');

        $page = (int) $request->input('page', 1);
        $perPage = 12;
        $paginatedItems = $sorted->slice(($page - 1) * $perPage, $perPage)->values()->map(fn ($d) => self::formatDocumentData($d));

        $paginator = new LengthAwarePaginator(
            $paginatedItems,
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return self::render('MaintenanceDocuments/Index', $request, [
            'documents' => $paginator,
            'projects' => $projects->map(fn ($p) => [
                'id' => (int) $p['id'],
                'project_title' => $p['project_title'],
                'municipality' => $p['municipality_name'] ?? 'Nabunturan',
            ])->values(),
            'filters' => $filters,
            'canWrite' => true,
        ]);
    }

    private static function formatDocumentData(array $row): array
    {
        $id = (int) $row['id'];
        $maintenanceId = (int) ($row['maintenance_id'] ?? 3);
        $projectId = (int) ($row['project_id'] ?? 1);

        return [
            'id' => $id,
            'maintenance_id' => $maintenanceId,
            'document_title' => $row['title'] ?? 'Maintenance Inspection Report',
            'description' => $row['description'] ?? 'Quarterly report documentation.',
            'file_name' => $row['file_name'] ?? 'report.pdf',
            'uploaded_by' => $row['uploaded_by'] ?? 'UserTest',
            'uploaded_at' => $row['uploaded_at'] ?? '2026-07-15T09:00:00Z',
            'updated_at' => $row['updated_at'] ?? '2026-07-15T09:00:00Z',
            'available' => true,
            'delete_url' => '/dd-phase3/files/document/' . $id,
            'download_url' => '#',
            'can_edit' => true,
            'project' => [
                'id' => $projectId,
                'project_title' => $row['project_title'] ?? 'Project Maintenance Antutu',
                'municipality' => $row['municipality_name'] ?? 'Nabunturan',
            ],
            'record' => [
                'id' => $maintenanceId,
                'project_id' => $projectId,
                'year' => 2026,
                'quarter' => 'Q2',
            ],
        ];
    }

    public static function documentShow(Request $request, int $id): Response
    {
        $store = self::getStore();
        $documents = collect($store['maintenance_documents'] ?? []);
        $doc = $documents->firstWhere('id', $id) ?? $documents->first();
        abort_unless($doc !== null, 404);

        $docData = self::formatDocumentData($doc);

        return self::render('MaintenanceDocuments/Show', $request, [
            'document' => $docData,
            'canWrite' => true,
        ]);
    }

    public static function documentForm(Request $request, ?int $id = null): Response
    {
        $store = self::getStore();
        $documents = collect($store['maintenance_documents'] ?? []);
        $projects = collect($store['maintenance_projects'] ?? []);
        $records = collect($store['maintenance_records'] ?? []);

        $doc = $id !== null ? ($documents->firstWhere('id', $id) ?? $documents->first()) : null;

        return self::render('MaintenanceDocuments/Form', $request, [
            'document' => $doc ? self::formatDocumentData($doc) : null,
            'projects' => $projects->map(fn ($p) => [
                'id' => (int) $p['id'],
                'project_title' => $p['project_title'],
                'municipality' => $p['municipality_name'] ?? 'Nabunturan',
            ])->values(),
            'records' => $records->map(fn ($r) => [
                'id' => (int) $r['id'],
                'project_id' => (int) ($r['project_id'] ?? 1),
                'quarter' => $r['quarter'] ?? 'Q1',
                'year' => (int) ($r['year'] ?? 2026),
            ])->values(),
            'contextRecordId' => null,
            'project' => null,
            'record' => null,
            'submitUrl' => '/dd-phase3/ui/maintenance-documents' . ($id === null ? '' : '/' . $id),
            'cancelUrl' => '/dd-phase3/ui/maintenance-documents' . ($id === null ? '' : '/' . $id),
        ]);
    }

    // ==========================================
    // AUDIT LOGS
    // ==========================================

    public static function auditIndex(Request $request): Response
    {
        $allEvents = [
            [
                'id' => 107,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (UserTest)',
                'current_account_type' => 'superadmin',
                'action' => 'LOGIN',
                'entity_type' => 'UserAccount',
                'entity_id' => 1,
                'description' => 'User UserTest signed in successfully.',
                'old_value' => null,
                'new_value' => null,
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-12T10:35:10Z',
            ],
            [
                'id' => 106,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (UserTest)',
                'current_account_type' => 'superadmin',
                'action' => 'UPDATE',
                'entity_type' => 'MaintenanceProject',
                'entity_id' => 1,
                'description' => 'Updated project schedule and budget allocation.',
                'old_value' => ['budget' => 2400000, 'status' => 'Ongoing'],
                'new_value' => ['budget' => 2500000, 'status' => 'Ongoing'],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-12T08:14:02Z',
            ],
            [
                'id' => 105,
                'user_id' => 3,
                'actor_identifier' => 'DD-UserAccount#3 (maria.cruz)',
                'current_account_type' => 'admin',
                'action' => 'CREATE',
                'entity_type' => 'MaintenanceDocument',
                'entity_id' => 3,
                'description' => 'Uploaded Provincial Road Clearance & Inspection Report.',
                'old_value' => null,
                'new_value' => ['file_name' => 'Clearance_Report_2026.pdf', 'size_kb' => 1420],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-11T16:22:15Z',
            ],
            [
                'id' => 104,
                'user_id' => 2,
                'actor_identifier' => 'DD-UserAccount#2 (juan.delacruz)',
                'current_account_type' => 'admin',
                'action' => 'CREATE',
                'entity_type' => 'MonthlyUpdate',
                'entity_id' => 2,
                'description' => 'Filed progress update for Nabunturan Corridor with site photos.',
                'old_value' => null,
                'new_value' => ['update_month' => '2026-03', 'media_count' => 4],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-11T14:05:40Z',
            ],
            [
                'id' => 103,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (superadmin)',
                'current_account_type' => 'superadmin',
                'action' => 'UPDATE',
                'entity_type' => 'RoadCoverage',
                'entity_id' => 1,
                'description' => 'Updated pavement classification from Gravel to Concrete.',
                'old_value' => ['pavement_type' => 'Gravel', 'condition' => 'Fair'],
                'new_value' => ['pavement_type' => 'Concrete', 'condition' => 'Good'],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-10T11:45:12Z',
            ],
            [
                'id' => 102,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (superadmin)',
                'current_account_type' => 'superadmin',
                'action' => 'CREATE',
                'entity_type' => 'UserAccount',
                'entity_id' => 4,
                'description' => 'Provisioned engineer user account for Engr. Roberto Santos.',
                'old_value' => null,
                'new_value' => ['username' => 'roberto.santos', 'role' => 'Engineer', 'lgu_id' => 3],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-09T09:30:00Z',
            ],
            [
                'id' => 101,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (superadmin)',
                'current_account_type' => 'superadmin',
                'action' => 'CREATE',
                'entity_type' => 'MaintenanceProject',
                'entity_id' => 2,
                'description' => 'Initiated Compostela Access Expansion project.',
                'old_value' => null,
                'new_value' => ['project_title' => 'Compostela Access Expansion', 'budget' => 1800000],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-08T08:15:00Z',
            ],
            [
                'id' => 100,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (superadmin)',
                'current_account_type' => 'superadmin',
                'action' => 'ACTIVATE',
                'entity_type' => 'UserAccount',
                'entity_id' => 2,
                'description' => 'Activated user account for juan.delacruz.',
                'old_value' => ['is_active' => false],
                'new_value' => ['is_active' => true],
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-07T14:20:00Z',
            ],
            [
                'id' => 99,
                'user_id' => 1,
                'actor_identifier' => 'DD-UserAccount#1 (superadmin)',
                'current_account_type' => 'superadmin',
                'action' => 'DELETE',
                'entity_type' => 'RoadCoverage',
                'entity_id' => 5,
                'description' => 'Removed duplicate road segment entry.',
                'old_value' => ['road_name' => 'Duplicate Segment'],
                'new_value' => null,
                'recipient_user_id' => null,
                'notification_message' => null,
                'created_at' => '2026-11-06T09:00:00Z',
            ],
        ];

        $page = (int) $request->input('page', 1);
        $perPage = 25;
        $collection = collect($allEvents);
        $paginatedItems = $collection->slice(($page - 1) * $perPage, $perPage)->values();

        $paginator = new \Illuminate\Pagination\LengthAwarePaginator(
            $paginatedItems,
            $collection->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        $actions = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'REASSIGN', 'RETIRE', 'LOGIN', 'LOGOUT'];
        $entities = ['MaintenanceProject', 'MaintenanceRecord', 'MonthlyUpdate', 'RoadCoverage', 'UserAccount', 'LGU', 'MaintenanceDocument'];

        $authPaginator = new \Illuminate\Pagination\LengthAwarePaginator([], 0, 25, 1, ['path' => $request->url(), 'pageName' => 'auth_page']);

        return self::render('dd-phase3/AuditHistory', $request, [
            'events' => $paginator,
            'authentication' => $authPaginator,
            'filters' => [
                'activity_search' => '',
                'activity_action' => '',
                'activity_entity' => '',
                'activity_order' => 'newest',
                'activity_from' => '',
                'activity_to' => '',
                'auth_search' => '',
                'auth_event' => '',
                'auth_from' => '',
                'auth_to' => '',
            ],
            'actions' => $actions,
            'entities' => $entities,
            'monitoring' => [
                'available' => false,
                'collecting' => false,
                'recent_failure_at' => null,
                'message' => 'Authentication monitoring is unavailable in preview mode. Business history remains available.',
            ],
            'presence' => [
                'available' => false,
                'message' => 'Online presence is unavailable in preview mode.',
                'window_seconds' => 300,
                'total' => 0,
                'accounts' => [],
            ],
            'summary' => [
                'system_activities' => $collection->count(),
                'logins' => null,
                'failed_logins' => null,
                'online_accounts' => null,
            ],
            'navigationSection' => 'audit-logs',
        ]);
    }

    // ==========================================
    // SEED DATA GENERATOR
    // ==========================================

    private static function initialData(): array
    {
        $lgus = [
            ['id' => 1, 'municipality_name' => 'Nabunturan', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Gavriel', 'mayor_middle_name' => 'Fritz', 'mayor_last_name' => 'Polbo', 'contact_no' => '09123456781'],
            ['id' => 2, 'municipality_name' => 'Compostela', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Keaton', 'mayor_middle_name' => 'Javier', 'mayor_last_name' => 'Rodriguez', 'contact_no' => '09123456782'],
            ['id' => 3, 'municipality_name' => 'Laak', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Neal', 'mayor_middle_name' => 'Jeramy', 'mayor_last_name' => 'Kunde', 'contact_no' => '09123456783'],
            ['id' => 4, 'municipality_name' => 'Mabini', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Mortimer', 'mayor_middle_name' => 'Rhoda', 'mayor_last_name' => 'Predovic', 'contact_no' => '09123456784'],
            ['id' => 5, 'municipality_name' => 'Maragusan', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Elna', 'mayor_middle_name' => 'Irving', 'mayor_last_name' => 'Stracke', 'contact_no' => '09123456785'],
            ['id' => 6, 'municipality_name' => 'Mawab', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Nathen', 'mayor_middle_name' => 'Annalise', 'mayor_last_name' => 'Stehr', 'contact_no' => '09123456786'],
            ['id' => 7, 'municipality_name' => 'Monkayo', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Manuel', 'mayor_middle_name' => 'B.', 'mayor_last_name' => 'Zamora', 'contact_no' => '09123456787'],
            ['id' => 8, 'municipality_name' => 'Montevista', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Cyrene', 'mayor_middle_name' => 'T.', 'mayor_last_name' => 'Belen', 'contact_no' => '09123456788'],
            ['id' => 9, 'municipality_name' => 'New Bataan', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Geraldford', 'mayor_middle_name' => 'N.', 'mayor_last_name' => 'Balbin', 'contact_no' => '09123456789'],
            ['id' => 10, 'municipality_name' => 'Pantukan', 'province' => 'Davao de Oro', 'region' => 'XI', 'mayor_first_name' => 'Roberto', 'mayor_middle_name' => 'M.', 'mayor_last_name' => 'Yugo', 'contact_no' => '09123456790'],
        ];

        $engineers = [
            ['id' => 1, 'first_name' => 'Gav', 'last_name' => 'Pol', 'lgu_id' => 1, 'rank' => 'Senior Engineer'],
            ['id' => 2, 'first_name' => 'Rey', 'last_name' => 'Santos', 'lgu_id' => 2, 'rank' => 'Project Engineer'],
            ['id' => 3, 'first_name' => 'Maria', 'last_name' => 'Cruz', 'lgu_id' => 3, 'rank' => 'Field Engineer'],
            ['id' => 4, 'first_name' => 'Alex', 'last_name' => 'Tan', 'lgu_id' => 6, 'rank' => 'Field Engineer'],
        ];

        $road_coverages = [
            [
                'id' => 1,
                'road_name' => 'Nabunturan Main Central Corridor',
                'lgu_id' => 1,
                'municipality_name' => 'Nabunturan',
                'pavement_type' => 'Concrete',
                'state_category' => 'Good',
                'kilometers' => 12.4,
                'geojson' => [
                    'type' => 'LineString',
                    'coordinates' => [
                        [125.9614, 7.6033],
                        [125.9720, 7.6250],
                        [125.9833, 7.7000],
                    ],
                ],
                'created_by' => 1,
                'created_by_name' => 'Gav Pol',
                'project_id' => 1,
                'project_title' => 'Project Maintenance Antutu',
                'created_at' => '2026-11-01T08:00:00Z',
                'updated_at' => '2026-11-01T08:00:00Z',
            ],
            [
                'id' => 2,
                'road_name' => 'Compostela Provincial Arterial Road',
                'lgu_id' => 2,
                'municipality_name' => 'Compostela',
                'pavement_type' => 'Asphalt',
                'state_category' => 'Fair',
                'kilometers' => 8.6,
                'geojson' => [
                    'type' => 'LineString',
                    'coordinates' => [
                        [126.0886, 7.6694],
                        [126.0750, 7.6500],
                        [126.0500, 7.6300],
                    ],
                ],
                'created_by' => 2,
                'created_by_name' => 'Rey Santos',
                'project_id' => 2,
                'project_title' => 'Compostela Access Expansion',
                'created_at' => '2026-11-02T09:30:00Z',
                'updated_at' => '2026-11-02T09:30:00Z',
            ],
            [
                'id' => 3,
                'road_name' => 'Monkayo Mountain Ridge Access',
                'lgu_id' => 7,
                'municipality_name' => 'Monkayo',
                'pavement_type' => 'Concrete',
                'state_category' => 'Good',
                'kilometers' => 16.2,
                'geojson' => [
                    'type' => 'LineString',
                    'coordinates' => [
                        [126.0500, 7.8500],
                        [126.0350, 7.8300],
                        [126.0100, 7.8000],
                    ],
                ],
                'created_by' => 1,
                'created_by_name' => 'Gav Pol',
                'project_id' => null,
                'project_title' => null,
                'created_at' => '2026-11-03T11:15:00Z',
                'updated_at' => '2026-11-03T11:15:00Z',
            ],
            [
                'id' => 4,
                'road_name' => 'Mawab Agusan River Bridge Bypass',
                'lgu_id' => 6,
                'municipality_name' => 'Mawab',
                'pavement_type' => 'Concrete',
                'state_category' => 'Good',
                'kilometers' => 5.1,
                'geojson' => [
                    'type' => 'LineString',
                    'coordinates' => [
                        [125.9556, 7.5022],
                        [125.9420, 7.5180],
                        [125.9300, 7.5300],
                    ],
                ],
                'created_by' => 4,
                'created_by_name' => 'Alex Tan',
                'project_id' => null,
                'project_title' => null,
                'created_at' => '2026-11-04T14:00:00Z',
                'updated_at' => '2026-11-04T14:00:00Z',
            ],
            [
                'id' => 5,
                'road_name' => 'Pantukan Coastal Farm-to-Market Road',
                'lgu_id' => 10,
                'municipality_name' => 'Pantukan',
                'pavement_type' => 'Gravel',
                'state_category' => 'Fair',
                'kilometers' => 9.8,
                'geojson' => [
                    'type' => 'LineString',
                    'coordinates' => [
                        [125.9000, 7.1200],
                        [125.9150, 7.1400],
                        [125.9300, 7.1700],
                    ],
                ],
                'created_by' => 1,
                'created_by_name' => 'Gav Pol',
                'project_id' => null,
                'project_title' => null,
                'created_at' => '2026-11-05T10:00:00Z',
                'updated_at' => '2026-11-05T10:00:00Z',
            ],
            [
                'id' => 6,
                'road_name' => 'Laak Agricultural Highway Link',
                'lgu_id' => 3,
                'municipality_name' => 'Laak',
                'pavement_type' => 'Concrete',
                'state_category' => 'Good',
                'kilometers' => 11.0,
                'geojson' => [
                    'type' => 'LineString',
                    'coordinates' => [
                        [125.7900, 7.8100],
                        [125.8050, 7.8250],
                        [125.8200, 7.8400],
                    ],
                ],
                'created_by' => 3,
                'created_by_name' => 'Maria Cruz',
                'project_id' => null,
                'project_title' => null,
                'created_at' => '2026-11-06T15:20:00Z',
                'updated_at' => '2026-11-06T15:20:00Z',
            ],
        ];

        $maintenance_projects = [
            [
                'id' => 1,
                'project_title' => 'Project Maintenance Antutu',
                'lgu_id' => 1,
                'municipality_name' => 'Nabunturan',
                'road_coverage_id' => 1,
                'road_name' => 'Nabunturan Main Central Corridor',
                'description' => 'Provincial highway periodic surfacing and culvert rehabilitation.',
                'status' => 'Ongoing',
                'budget' => 2500000.00,
                'start_date' => '2026-01-15',
                'target_completion_date' => '2026-12-31',
                'record_count' => 2,
            ],
            [
                'id' => 2,
                'project_title' => 'Compostela Access Expansion',
                'lgu_id' => 2,
                'municipality_name' => 'Compostela',
                'road_coverage_id' => 2,
                'road_name' => 'Compostela Provincial Arterial Road',
                'description' => 'Widening of agricultural access artery and shoulder pavement.',
                'status' => 'Completed',
                'budget' => 1800000.00,
                'start_date' => '2026-03-01',
                'target_completion_date' => '2026-10-30',
                'record_count' => 1,
            ],
        ];

        $maintenance_records = [
            [
                'id' => 3,
                'project_id' => 1,
                'project_title' => 'Project Maintenance Antutu',
                'municipality_name' => 'Nabunturan',
                'lgu_id' => 1,
                'maintenance_year' => 2026,
                'quarter' => 'Q2',
                'status' => 'Completed',
                'managing_engineer_name' => 'gav pol',
                'start_date' => '2026-11-18',
                'completion_date' => '2026-11-19',
                'estimated_duration_days' => 231123,
                'description' => 'No description provided.',
                'created_by' => 'UserTest',
                'created_at' => '2026-11-09T14:58:00Z',
                'updated_at' => '2026-11-09T14:58:00Z',
            ],
            [
                'id' => 2,
                'project_id' => 1,
                'project_title' => 'Project Maintenance Antutu',
                'municipality_name' => 'Nabunturan',
                'lgu_id' => 1,
                'maintenance_year' => 2026,
                'quarter' => 'Q1',
                'status' => 'Completed',
                'managing_engineer_name' => 'gav pol',
                'start_date' => '2026-01-10',
                'completion_date' => '2026-03-30',
                'estimated_duration_days' => 80,
                'description' => 'First quarter periodic culvert cleaning and shoulder reshaping.',
                'created_by' => 'UserTest',
                'created_at' => '2026-01-05T10:00:00Z',
                'updated_at' => '2026-01-05T10:00:00Z',
            ],
        ];

        $monthly_updates = [
            [
                'id' => 1,
                'maintenance_id' => 3,
                'project_id' => 1,
                'project_title' => 'Project Maintenance Antutu',
                'update_month' => '2026-07',
                'progress_percentage' => 0.0,
                'media_count' => 0,
                'photo_count' => 0,
                'video_count' => 0,
                'summary' => 'Initial mobilization and equipment setup.',
                'created_by' => 'UserTest',
                'created_at' => '2026-07-01T00:00:00Z',
                'updated_at' => '2026-07-01T00:00:00Z',
            ],
        ];

        $maintenance_documents = [
            [
                'id' => 1,
                'maintenance_id' => 3,
                'project_id' => 1,
                'project_title' => 'Project Maintenance Antutu',
                'municipality_name' => 'Nabunturan',
                'title' => 'Project Inception & Inspection Report',
                'description' => 'Initial inspection and engineering site handover document.',
                'file_name' => 'inspection_report_q2_2026.pdf',
                'file_size' => 2048576,
                'uploaded_by' => 'UserTest',
                'uploaded_at' => '2026-07-15T09:00:00Z',
                'updated_at' => '2026-07-15T09:00:00Z',
            ],
        ];

        return [
            'lgus' => $lgus,
            'engineers' => $engineers,
            'road_coverages' => $road_coverages,
            'maintenance_projects' => $maintenance_projects,
            'maintenance_records' => $maintenance_records,
            'monthly_updates' => $monthly_updates,
            'maintenance_documents' => $maintenance_documents,
        ];
    }

    private static function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadiusKm = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadiusKm * $c;
    }
}
