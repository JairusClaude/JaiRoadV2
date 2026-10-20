<?php

// Frontend review route for JaiROADS LGU master-data directory.
// No changes to the existing /lgus controller, policies, database or data.

use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->get('/lgus-preview', function () {
    // Final JaiROADS Data Dictionary: all active roles may READ LGU master data.
    // Engineer/Viewer receive no LGU create/update/delete endpoint via this preview.
    $role = app(VerifiedProjectAccount::class)->role(request()->user());
    abort_unless(in_array($role, ['admin', 'superadmin', 'engineer', 'viewer'], true), 403);

    $records = collect();
    $notice = null;
    $fields = [
        'municipality' => false,
        'province' => false,
        'region' => false,
        'mayorFirst' => false,
        'mayorMiddle' => false,
        'mayorLast' => false,
        'roadLinks' => false,
        'engineerAssignments' => false,
    ];

    if (! Schema::hasTable('lgus')) {
        $notice = 'The LGU table does not exist on this database. No changes have been made.';
    } else {
        $columns = Schema::getColumnListing('lgus');
        if (! in_array('id', $columns, true) || ! in_array('municipality_name', $columns, true)) {
            $notice = 'The LGU table does not have the expected id and municipality_name columns. No changes have been made.';
        } else {
            // Optional fields reflect the Data Dictionary; their existence in the
            // connected PostgreSQL schema is checked instead of assumed.
            $names = [
                'municipality' => ['municipality_name'],
                'province' => ['province'],
                'region' => ['region'],
                'mayorFirst' => ['mayor_first_name', 'mayor_firstname'],
                'mayorMiddle' => ['mayor_middle_name', 'mayor_middlename'],
                'mayorLast' => ['mayor_last_name', 'mayor_lastname'],
            ];
            $chosen = [];
            foreach ($names as $key => $possibilities) {
                foreach ($possibilities as $candidate) {
                    if (in_array($candidate, $columns, true)) {
                        $chosen[$key] = $candidate;
                        $fields[$key] = true;
                        break;
                    }
                }
            }

            $select = array_unique(array_merge(['id'], array_values($chosen)));
            $raw = DB::table('lgus')->orderBy('id')->limit(500)->get($select);

            // RoadCoverage has a required LGU foreign key. Count linked coverages
            // only if the actual deployed schema supports that relationship.
            $roadCounts = collect();
            if (Schema::hasTable('road_coverages')) {
                $roadCol = Schema::hasColumn('road_coverages', 'lgu_id') ? 'lgu_id' : (
                    Schema::hasColumn('road_coverages', 'lgus_id') ? 'lgus_id' : null
                );
                if ($roadCol !== null) {
                    $roadCounts = DB::table('road_coverages')
                        ->select($roadCol)->selectRaw('COUNT(*) AS total')
                        ->groupBy($roadCol)->get()->keyBy($roadCol);
                    $fields['roadLinks'] = true;
                }
            }

            // The team has described EngineerLGU, but the actual pivot table
            // may not yet be installed. Do not invent assignment counts.
            $assignmentCounts = collect();
            foreach (['engineer_lgus', 'engineer_lgu'] as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }
                $lguCol = Schema::hasColumn($table, 'lgu_id') ? 'lgu_id' : (
                    Schema::hasColumn($table, 'lgus_id') ? 'lgus_id' : null
                );
                if ($lguCol === null) {
                    continue;
                }
                $activeCol = Schema::hasColumn($table, 'is_active') ? 'is_active' : null;
                $query = DB::table($table);
                if ($activeCol !== null) {
                    $query->where($activeCol, true);
                }
                $assignmentCounts = $query->select($lguCol)
                    ->selectRaw('COUNT(*) AS total')
                    ->groupBy($lguCol)->get()->keyBy($lguCol);
                $fields['engineerAssignments'] = true;
                break;
            }

            $records = $raw->map(static function ($row) use ($chosen, $roadCounts, $assignmentCounts, $fields) {
                $value = static fn ($key) => isset($chosen[$key]) ? ($row->{$chosen[$key]} ?? null) : null;

                return [
                    'id' => (int) $row->id,
                    'municipalityName' => (string) $value('municipality'),
                    'province' => $value('province'),
                    'region' => $value('region'),
                    'mayorFirstName' => $value('mayorFirst'),
                    'mayorMiddleName' => $value('mayorMiddle'),
                    'mayorLastName' => $value('mayorLast'),
                    'roadCoverageCount' => $fields['roadLinks'] ? (int) ($roadCounts->get($row->id)->total ?? 0) : null,
                    'activeAssignmentCount' => $fields['engineerAssignments'] ? (int) ($assignmentCounts->get($row->id)->total ?? 0) : null,
                ];
            })->values();

            if ($raw->count() === 500) {
                $notice = 'Showing at most 500 LGUs for this frontend preview. Server-side pagination is not implemented yet.';
            }
        }
    }

    return Inertia::render('lgus-preview/Index', [
        'initialLgus' => $records->all(),
        'availableFields' => $fields,
        'schemaNotice' => $notice,
        // All displayed LGU records are read-only for Engineer/Viewer.
        // Existing Admin browser-only draft prototype has no database writes.
        'canPreviewDraft' => in_array($role, ['admin', 'superadmin'], true),
    ]);
})->name('lgus.preview');
