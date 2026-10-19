<?php

// Official JaiROADS Admin Dashboard: authenticated, verified, admin-only, read-only.
// This route intentionally does not replace or weaken the existing /dashboard route.
// No migration, account mutation, or storage write is performed here.

\Illuminate\Support\Facades\Route::middleware(['auth', 'verified'])
    ->get('/admin-dashboard', function (): \Inertia\Response {
        $user = request()->user();
        $role = strtolower((string) app(\App\Services\MaintenanceProjects\VerifiedProjectAccount::class)->role($user));
        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);

        // Discover the actual schema instead of assuming newer dictionary columns
        // are already present in the shared Supabase database.
        $columns = [];
        $has = static function (string $table, array $required = []) use (&$columns): bool {
            if (! array_key_exists($table, $columns)) {
                $columns[$table] = \Illuminate\Support\Facades\Schema::hasTable($table)
                    ? \Illuminate\Support\Facades\Schema::getColumnListing($table)
                    : null;
            }
            return $columns[$table] !== null
                && count(array_diff($required, $columns[$table])) === 0;
        };
        $count = static function (string $table) use ($has): ?int {
            return $has($table) ? (int) \Illuminate\Support\Facades\DB::table($table)->count() : null;
        };
        $db = \Illuminate\Support\Facades\DB::class;

        $stats = [
            'projects' => $count('maintenance_projects'),
            'roads' => $count('road_coverages'),
            'kilometers' => $has('road_coverages', ['kilometers'])
                ? round((float) $db::table('road_coverages')->sum('kilometers'), 2)
                : null,
            'lgus' => $count('lgus'),
            'engineers' => $count('engineers'),
            'maintenanceRecords' => $count('maintenance_records'),
            'monthlyUpdates' => $count('monthly_updates'),
            'documents' => $count('project_documents'),
            'accounts' => $count('user_accounts'),
            'activeAccounts' => $has('user_accounts', ['is_active'])
                ? (int) $db::table('user_accounts')->where('is_active', true)->count()
                : null,
        ];
        $stats['inactiveAccounts'] = $has('user_accounts', ['is_active'])
            ? (int) $db::table('user_accounts')->where('is_active', false)->count()
            : null;

        $statusBreakdown = [];
        if ($has('maintenance_records', ['status'])) {
            $actual = $db::table('maintenance_records')
                ->selectRaw('LOWER(TRIM(status)) AS name, COUNT(*) AS total')
                ->groupByRaw('LOWER(TRIM(status))')->pluck('total', 'name');
            foreach (['ongoing', 'completed'] as $name) {
                $statusBreakdown[] = ['name' => ucfirst($name), 'count' => (int) ($actual[$name] ?? 0)];
            }
            $other = max(0, (int) $stats['maintenanceRecords'] - array_sum(array_column($statusBreakdown, 'count')));
            if ($other > 0) {
                $statusBreakdown[] = ['name' => 'Other', 'count' => $other];
            }
        }
        $stats['ongoingRecords'] = $statusBreakdown
            ? $statusBreakdown[0]['count'] : null;

        $roadConditions = [];
        if ($has('road_coverages', ['state_category'])) {
            $actual = $db::table('road_coverages')
                ->selectRaw('state_category AS name, COUNT(*) AS total')
                ->groupBy('state_category')->pluck('total', 'name');
            foreach (['Good', 'Fair', 'Bad'] as $name) {
                $roadConditions[] = ['name' => $name, 'count' => (int) ($actual[$name] ?? 0)];
            }
            $other = max(0, (int) $stats['roads'] - array_sum(array_column($roadConditions, 'count')));
            if ($other > 0) {
                $roadConditions[] = ['name' => 'Other', 'count' => $other];
            }
        }
        $pavementTypes = [];
        if ($has('road_coverages', ['pavement_type'])) {
            $actual = $db::table('road_coverages')
                ->selectRaw('pavement_type AS name, COUNT(*) AS total')
                ->groupBy('pavement_type')->pluck('total', 'name');
            foreach (['Concrete', 'Asphalt', 'Gravel', 'Earth'] as $name) {
                $pavementTypes[] = ['name' => $name, 'count' => (int) ($actual[$name] ?? 0)];
            }
            $other = max(0, (int) $stats['roads'] - array_sum(array_column($pavementTypes, 'count')));
            if ($other > 0) {
                $pavementTypes[] = ['name' => 'Other', 'count' => $other];
            }
        }

        $quarterlyActivities = [];
        if ($has('maintenance_records', ['maintenance_year', 'quarter'])) {
            $quarterlyActivities = $db::table('maintenance_records')
                ->select('maintenance_year', 'quarter')
                ->selectRaw('COUNT(*) AS total')
                ->groupBy('maintenance_year', 'quarter')
                ->orderByDesc('maintenance_year')->orderByDesc('quarter')
                ->limit(12)->get()
                ->reverse()->values()
                ->map(static fn ($row): array => [
                    'label' => (string) $row->maintenance_year.' '.(string) $row->quarter,
                    'count' => (int) $row->total,
                ])->all();
        }

        // Most recent projects, with municipality resolved THROUGH RoadCoverage.
        $recentProjects = [];
        if ($has('maintenance_projects', ['id', 'project_title'])) {
            $fields = ['id', 'project_title'];
            if ($has('maintenance_projects', ['road_coverage_id'])) {
                $fields[] = 'road_coverage_id';
            }
            if ($has('maintenance_projects', ['created_at'])) {
                $fields[] = 'created_at';
            }
            $projects = $db::table('maintenance_projects')->orderByDesc('id')->limit(6)->get($fields);
            $coverageLookup = collect();
            $lguLookup = collect();
            if ($has('road_coverages', ['id', 'lgu_id', 'kilometers']) && in_array('road_coverage_id', $fields, true)) {
                $coverageLookup = $db::table('road_coverages')
                    ->whereIn('id', $projects->pluck('road_coverage_id')->filter()->unique()->all())
                    ->get(['id', 'lgu_id', 'kilometers'])->keyBy('id');
                if ($has('lgus', ['id', 'municipality_name'])) {
                    $lguLookup = $db::table('lgus')
                        ->whereIn('id', $coverageLookup->pluck('lgu_id')->filter()->unique()->all())
                        ->get(['id', 'municipality_name'])->keyBy('id');
                }
            }
            foreach ($projects as $project) {
                $coverage = isset($project->road_coverage_id)
                    ? $coverageLookup->get($project->road_coverage_id) : null;
                $lgu = $coverage ? $lguLookup->get($coverage->lgu_id) : null;
                $recentProjects[] = [
                    'id' => (int) $project->id,
                    'title' => (string) $project->project_title,
                    'municipality' => $lgu ? (string) $lgu->municipality_name : null,
                    'kilometers' => $coverage ? (float) $coverage->kilometers : null,
                ];
            }
        }

        // Record/activity data uses the live table's actual FK spelling.
        $recentRecords = [];
        $recordFk = $has('maintenance_records', ['maintenance_projects_id'])
            ? 'maintenance_projects_id'
            : ($has('maintenance_records', ['project_id']) ? 'project_id' : null);
        if ($recordFk !== null
            && $has('maintenance_records', ['id', 'maintenance_year', 'quarter', 'status'])
            && $has('maintenance_projects', ['id', 'project_title'])) {
            $records = $db::table('maintenance_records')
                ->orderByDesc('id')->limit(6)
                ->get(['id', $recordFk, 'maintenance_year', 'quarter', 'status']);
            $titles = $db::table('maintenance_projects')
                ->whereIn('id', $records->pluck($recordFk)->unique()->all())
                ->pluck('project_title', 'id');
            foreach ($records as $record) {
                $projectId = (int) $record->{$recordFk};
                $recentRecords[] = [
                    'id' => (int) $record->id,
                    'projectId' => $projectId,
                    'projectTitle' => (string) ($titles[$projectId] ?? ('Project #'.$projectId)),
                    'period' => $record->maintenance_year.' · '.$record->quarter,
                    'status' => (string) $record->status,
                ];
            }
        }

        $topLgus = [];
        if ($has('lgus', ['id', 'municipality_name'])
            && $has('road_coverages', ['id', 'lgu_id', 'kilometers'])) {
            $topLgus = $db::table('lgus as l')
                ->leftJoin('road_coverages as r', 'r.lgu_id', '=', 'l.id')
                ->select('l.id', 'l.municipality_name')
                ->selectRaw('COUNT(r.id) AS road_count, COALESCE(SUM(r.kilometers), 0) AS total_km')
                ->groupBy('l.id', 'l.municipality_name')
                ->orderByDesc('road_count')->orderBy('l.municipality_name')
                ->limit(5)->get()
                ->map(static fn ($row): array => [
                    'id' => (int) $row->id,
                    'name' => (string) $row->municipality_name,
                    'roads' => (int) $row->road_count,
                    'kilometers' => round((float) $row->total_km, 2),
                ])->all();
        }

        $notices = [];
        if ($has('monthly_updates', ['maintenance_projects_id'])
            && ! $has('monthly_updates', ['maintenance_records_id'])
            && ! $has('monthly_updates', ['maintenance_id'])) {
            $notices[] = 'Monthly Updates still reference Maintenance Projects instead of Maintenance Records. Their total is a legacy inventory count until the schema is aligned.';
        }
        if ($has('project_documents', ['maintenance_projects_id'])
            && ! $has('project_documents', ['maintenance_records_id'])
            && ! $has('project_documents', ['maintenance_id'])) {
            $notices[] = 'Project Documents use a legacy project relationship. Document totals are inventory counts until the Maintenance Record mapping is verified.';
        }

        $pathIfRegistered = static function (string $path): ?string {
            foreach (\Illuminate\Support\Facades\Route::getRoutes()->getRoutes() as $route) {
                if (in_array('GET', $route->methods(), true)
                    && trim($route->uri(), '/') === trim($path, '/')) {
                    return '/'.trim($path, '/');
                }
            }
            return null;
        };
        $destination = static function (array $paths) use ($pathIfRegistered): ?string {
            foreach ($paths as $path) {
                $url = $pathIfRegistered($path);
                if ($url !== null) return $url;
            }
            return null;
        };

        return \Inertia\Inertia::render('AdminDashboard/Index', [
            'viewer' => [
                'name' => (string) $user->name,
                'role' => $role,
            ],
            'stats' => $stats,
            'statuses' => $statusBreakdown,
            'conditions' => $roadConditions,
            'pavements' => $pavementTypes,
            'quarterly' => $quarterlyActivities,
            'recentProjects' => $recentProjects,
            'recentRecords' => $recentRecords,
            'topLgus' => $topLgus,
            'notices' => $notices,
            'generatedAt' => now()->toIso8601String(),
            'links' => [
                'projects' => $destination(['maintenance-projects']),
                'roads' => $destination(['road-sections-preview', 'road-coverages']),
                'updates' => $destination(['monthly-updates-preview', 'monthly-updates']),
                'documents' => $destination(['project-documents-preview', 'project-documents']),
                'accounts' => $destination(['user-management']),
                'lgus' => $destination(['lgus-preview', 'lgus']),
            ],
        ]);
    })->name('jairoads.admin-dashboard');
