<?php

// Road Sections (RoadCoverage) FRONTEND REVIEW ONLY.
// Keeps the existing RoadCoverageController, policies and /roads route untouched.
// Queries shared Supabase PostgreSQL read-only; no migrations/seeding/CRUD.

use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->get('/road-sections-preview', function () {
    $role = app(VerifiedProjectAccount::class)->role(request()->user());
    // Read permission is granted to every recognized active JaiROADS role.
    // This is a read-only preview endpoint, not an Engineer write endpoint.
    abort_unless(in_array($role, ['admin', 'superadmin', 'engineer', 'viewer'], true), 403);

    $required = ['id', 'road_name', 'lgu_id', 'kilometers', 'pavement_type', 'state_category', 'geojson', 'created_by'];
    $notice = null;
    $roads = collect();
    $lgus = collect();
    if (! Schema::hasTable('road_coverages')) {
        $notice = 'The RoadCoverage table has not been created on this database.';
    } else {
        $columns = Schema::getColumnListing('road_coverages');
        $missing = array_values(array_diff($required, $columns));
        if ($missing) {
            $notice = 'The RoadCoverage table differs from the current dictionary; missing: '.implode(', ', $missing).'. Nothing has been changed.';
        } else {
            $coverageRows = DB::table('road_coverages')->orderByDesc('id')->limit(300)->get($required);
            $links = collect();
            if (Schema::hasTable('maintenance_projects') && Schema::hasColumn('maintenance_projects', 'road_coverage_id')) {
                $links = DB::table('maintenance_projects')
                    ->whereNotNull('road_coverage_id')
                    ->get(['id', 'road_coverage_id', 'project_title'])
                    ->keyBy('road_coverage_id');
            }
            $roads = $coverageRows->map(static function ($road) use ($links) {
                $project = $links->get($road->id);
                $geometry = $road->geojson;
                if (is_string($geometry)) {
                    $decoded = json_decode($geometry, true);
                    $geometry = is_array($decoded) ? $decoded : null;
                }
                return [
                    'id' => (int) $road->id,
                    'roadName' => (string) $road->road_name,
                    'lguId' => (int) $road->lgu_id,
                    'kilometers' => (float) $road->kilometers,
                    'pavementType' => (string) $road->pavement_type,
                    'stateCategory' => (string) $road->state_category,
                    'geojson' => $geometry,
                    'createdByEngineerId' => (int) $road->created_by,
                    'projectId' => $project ? (int) $project->id : null,
                    'projectTitle' => $project ? (string) $project->project_title : null,
                    'localDraft' => false,
                ];
            })->values();
            if ($coverageRows->count() === 300) {
                $notice = 'Showing up to 300 of the newest coverages for this interface preview. Full server-side pagination is not yet implemented.';
            }
        }
    }

    if (Schema::hasTable('lgus') && Schema::hasColumn('lgus', 'municipality_name')) {
        $lgus = DB::table('lgus')->orderBy('municipality_name')->get(['id', 'municipality_name'])
            ->map(static fn ($lgu) => [
                'id' => (int) $lgu->id,
                'name' => (string) $lgu->municipality_name,
            ]);
    }

    return Inertia::render('road-sections-preview/Index', [
        'initialCoverages' => $roads->all(),
        'lgus' => $lgus->all(),
        'schemaNotice' => $notice,
        // The browser-only prototype is deliberately limited to administrators.
        // Engineer create/update requires separate active EngineerLGU-scoped endpoints.
        'canPreviewDraft' => in_array($role, ['admin', 'superadmin'], true),
    ]);
})->name('road-sections.preview');
