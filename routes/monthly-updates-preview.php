<?php

// JaiROADS Monthly Updates â€” safe READ-ONLY preview.
// Mount this file once from routes/web.php. This does not change Supabase tables.
// The data-dictionary relationship is MaintenanceRecord -> MonthlyUpdate -> Media.
// If the legacy database does not implement that mapping, the page displays a
// schema notice rather than treating a project-level update as a maintenance update.

use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use App\Services\MaintenanceProjects\SidebarMaintenanceRecordScope;
use App\Services\MonthlyUpdates\MonthlyUpdatesReadiness;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use App\Models\MonthlyUpdate;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->get('/monthly-updates-preview', function () {
    $user = request()->user();
    abort_unless($user instanceof \App\Models\User, 401);
    $role = app(VerifiedProjectAccount::class)->role($user);
    abort_unless($role !== null, 403);
    $scopedRecords = app(SidebarMaintenanceRecordScope::class);

    $maintenanceRecords = collect();
    if (Schema::hasTable('maintenance_records')) {
        $parents = $scopedRecords->visibleQuery($user)
            ->orderByDesc('maintenance_records.id')
            ->limit(250)
            ->get(['id', 'maintenance_projects_id', 'maintenance_year', 'quarter', 'status']);
        $projectIds = $parents->pluck('maintenance_projects_id')->filter()->unique()->values()->all();
        $projects = $projectIds
            ? DB::table('maintenance_projects')->whereIn('id', $projectIds)->pluck('project_title', 'id')
            : collect();
        $maintenanceRecords = $parents->map(function ($parent) use ($projects) {
            return [
                'id' => (int) $parent->id,
                'projectId' => (int) $parent->maintenance_projects_id,
                'projectTitle' => (string) ($projects[$parent->maintenance_projects_id] ?? ('Project #' . $parent->maintenance_projects_id)),
                'year' => $parent->maintenance_year === null ? null : (int) $parent->maintenance_year,
                'quarter' => $parent->quarter,
                'status' => (string) $parent->status,
            ];
        });
    }

    $updates = collect();
    $schemaNotice = null;
    $mediaNotice = null;

    if (! Schema::hasTable('monthly_updates')) {
        $schemaNotice = 'The monthly_updates table is not present. Verify the migration with your team before enabling reports.';
    } else {
        $columns = Schema::getColumnListing('monthly_updates');
        $firstMatch = static function (array $candidates) use ($columns): ?string {
            foreach ($candidates as $candidate) {
                if (in_array($candidate, $columns, true)) {
                    return $candidate;
                }
            }
            return null;
        };
        $maintenanceFk = $firstMatch(['maintenance_records_id', 'maintenance_record_id', 'maintenance_id', 'MaintenanceID']);
        $monthField = $firstMatch(['update_month', 'UpdateMonth', 'month', 'report_month']);
        $summaryField = $firstMatch(['summary_of_text_reports', 'summary', 'report', 'description', 'progress_report', 'report_text']);
        $authorField = $firstMatch(['created_by', 'user_account_id', 'created_by_user_account_id']);
        $progressField = $firstMatch(['progress_percentage']);
        $createdAtField = $firstMatch(['created_at']);

        if ($maintenanceFk === null || $monthField === null || $summaryField === null) {
            $missing = [];
            if ($maintenanceFk === null) {
                $missing[] = in_array('maintenance_projects_id', $columns, true)
                    ? 'the table links to Maintenance Projects through maintenance_projects_id, not Maintenance Records'
                    : 'no recognized MaintenanceRecord foreign key';
            }
            if ($monthField === null) {
                $missing[] = 'no recognized reporting-month field';
            }
            if ($summaryField === null) {
                $missing[] = in_array('summary_of_text_reports', $columns, true)
                    ? 'summary_of_text_reports exists, but this preview does not yet map it as the report summary'
                    : 'no recognized report-summary field';
            }
            $schemaNotice = 'Record-linked Monthly Updates are unavailable: ' . implode('; ', $missing)
                . '. The physical table remains unchanged. Confirm the relationship and field mappings with the team before enabling writes.';
        } else {
            $select = array_values(array_unique(array_filter(['id', $maintenanceFk, $monthField, $summaryField, $authorField, $createdAtField, $progressField])));
            $updateQuery = DB::table('monthly_updates');
            if ($role === 'engineer') {
                $updateQuery->whereIn($maintenanceFk, $maintenanceRecords->pluck('id')->all());
            }
            $rows = $updateQuery->orderByDesc('id')->limit(250)->get($select);
            $authors = collect();
            if ($authorField && Schema::hasTable('user_accounts')) {
                $ids = $rows->pluck($authorField)->filter()->unique()->values()->all();
                if ($ids) {
                    $authors = DB::table('user_accounts')->whereIn('id', $ids)->pluck('username', 'id');
                }
            }
            $updates = $rows->filter(static fn ($row) => preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', (string) $row->{$monthField}) === 1)
                ->map(static function ($row) use ($maintenanceFk, $monthField, $summaryField, $authorField, $createdAtField, $progressField, $authors) {
                    $authorId = $authorField ? $row->{$authorField} : null;
                    return [
                        'id' => (int) $row->id,
                        'maintenanceRecordId' => (int) $row->{$maintenanceFk},
                        'month' => (string) $row->{$monthField},
                        'summary' => (string) $row->{$summaryField},
                        'progressPercentage' => $progressField ? (float) $row->{$progressField} : null,
                        'author' => $authorId ? (string) ($authors[$authorId] ?? ('Account #' . $authorId)) : 'Not recorded',
                        'createdAt' => $createdAtField ? (string) $row->{$createdAtField} : null,
                        'mediaCount' => 0,
                    ];
                })->values();
            if ($rows->count() !== $updates->count()) {
                $schemaNotice = 'Some legacy monthly_updates entries have a month value outside the required YYYY-MM format and were hidden pending a data review.';
            }
        }
    }

    $mediaTable = Schema::hasTable('media') ? 'media' : (Schema::hasTable('updates_media') ? 'updates_media' : null);
    if ($mediaTable !== null && $updates->isNotEmpty()) {
        $mediaColumns = Schema::getColumnListing($mediaTable);
        $mediaFk = null;
        foreach (['monthly_updates_id', 'monthly_update_id', 'MonthlyUpdateID'] as $candidate) {
            if (in_array($candidate, $mediaColumns, true)) { $mediaFk = $candidate; break; }
        }
        if ($mediaFk !== null) {
            $updateIds = $updates->pluck('id')->all();
            $counts = DB::table($mediaTable)->whereIn($mediaFk, $updateIds)
                ->select($mediaFk)->selectRaw('COUNT(*) AS total')
                ->groupBy($mediaFk)->pluck('total', $mediaFk);
            $downloads = collect();
            if ($mediaTable === 'media' && Schema::hasColumns('media', ['id', 'file_name'])) {
                $downloads = DB::table('media')->whereIn($mediaFk, $updateIds)
                    ->get(['id', 'file_name', $mediaFk])->groupBy($mediaFk);
            }
            $updates = $updates->map(static function (array $update) use ($counts, $downloads) {
                $update['mediaCount'] = (int) ($counts[$update['id']] ?? 0);
                $update['mediaFiles'] = ($downloads[$update['id']] ?? collect())->map(static fn ($file) => [
                    'id' => (int) $file->id,
                    'name' => (string) $file->file_name,
                ])->values()->all();
                return $update;
            });
        } else {
            $mediaNotice = "The {$mediaTable} table exists but has no recognized MonthlyUpdate foreign key. Media counts and attachments need schema review.";
        }
    } elseif ($mediaTable === null) {
        $mediaNotice = 'No Media table was found. Photo/video relationships are planned but not yet enabled.';
    }

    // The read path always remains available. Real saves are a separate gated route.
    // Never mistake a present table alone for approval to enable mutations.
    $ready = app(MonthlyUpdatesReadiness::class)->canWrite()
        && app(PrivateMonthlyMediaStorage::class)->configured();
    $canWrite = $ready && in_array($role, ['admin', 'superadmin', 'engineer'], true);
    if ($canWrite && $role === 'engineer') {
        $maintenanceRecords = $maintenanceRecords->filter(static function (array $option) use ($user) {
            $record = \App\Models\MaintenanceRecord::query()->find($option['id']);
            return $record && Gate::forUser($user)->allows('createForRecord', [MonthlyUpdate::class, $record]);
        })->values();
        $canWrite = $maintenanceRecords->isNotEmpty();
    }
    return Inertia::render('monthly-updates/Index', [
        'initialUpdates' => $updates->all(),
        'maintenanceRecords' => $maintenanceRecords->all(),
        'schemaNotice' => $schemaNotice,
        'mediaNotice' => $mediaNotice,
        'canDraft' => in_array($role, ['admin', 'superadmin'], true),
        'canWrite' => $canWrite,
    ]);
})->name('monthly-updates.preview');



// Explicit, separately gated save/download endpoints. The legacy resource
// controller stays fail-closed and is not silently activated by this release.
require __DIR__.'/monthly-updates-actions.php';
