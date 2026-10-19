<?php

// JaiROADS Project Documents frontend prototype.
// Underlying entity: MaintenanceDocument, which belongs to MaintenanceRecord.
// READ-ONLY database integration: NEVER writes DB rows or storage objects.
// This route does not replace the existing MaintenanceDocumentController CRUD routes.

use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use App\Services\MaintenanceProjects\SidebarMaintenanceRecordScope;
use App\Services\Documents\PrivateSupabaseStorage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->get('/project-documents-preview', function () {
    $user = request()->user();
    abort_unless($user instanceof \App\Models\User, 401);
    $accounts = app(VerifiedProjectAccount::class);
    $role = $accounts->role($user);
    $scopedRecords = app(SidebarMaintenanceRecordScope::class);

    // Preview is admin-only until record-scoped all-role view permissions have
    // been reviewed and implemented. Do not confuse this with the final policy.
    abort_unless($role !== null, 403);

    $records = collect();
    if (Schema::hasTable('maintenance_records') && Schema::hasTable('maintenance_projects')) {
        $parents = $scopedRecords->visibleQuery($user)
            ->orderByDesc('maintenance_records.id')
            ->limit(250)
            ->get(['id', 'maintenance_projects_id', 'maintenance_year', 'quarter', 'status']);
        $projectIds = $parents->pluck('maintenance_projects_id')->filter()->unique()->values()->all();
        $projectTitles = $projectIds
            ? DB::table('maintenance_projects')->whereIn('id', $projectIds)->pluck('project_title', 'id')
            : collect();
        $records = $parents->map(static function ($parent) use ($projectTitles) {
            return [
                'id' => (int) $parent->id,
                'projectTitle' => (string) ($projectTitles[$parent->maintenance_projects_id] ?? ('Project #'.$parent->maintenance_projects_id)),
                'year' => $parent->maintenance_year === null ? null : (int) $parent->maintenance_year,
                'quarter' => (string) $parent->quarter,
                'status' => (string) $parent->status,
            ];
        })->values();
    }

    $documents = collect();
    $notice = null;
    // project_documents is the existing legacy physical table. Its name is
    // not evidence that rows are attached to MaintenanceRecord.
    $table = Schema::hasTable('maintenance_documents') ? 'maintenance_documents' : null;

    if ($table === null) {
        $notice = 'No MaintenanceDocument table was found. Agree on the physical table and migration with the backend team before enabling uploads.';
    } else {
        $columns = Schema::getColumnListing($table);
        $pick = static function (array $candidates) use ($columns): ?string {
            foreach ($candidates as $candidate) {
                if (in_array($candidate, $columns, true)) {
                    return $candidate;
                }
            }
            return null;
        };
        $recordFk = $pick(['maintenance_records_id', 'maintenance_record_id', 'maintenance_id', 'MaintenanceID']);
        $titleField = $pick(['document_title', 'DocumentTitle', 'title']);
        $nameField = $pick(['file_name', 'FileName']);
        $pathField = $pick(['file_path', 'FilePath']);
        $descriptionField = $pick(['description', 'Description']);
        $uploadedByField = $pick(['uploaded_by', 'UploadedBy', 'created_by']);
        $uploadedAtField = $pick(['uploaded_at', 'UploadedAt', 'created_at']);

        // Never reinterpret project-level legacy documents as record documents.
        if ($recordFk === null || $titleField === null || $nameField === null || $pathField === null) {
            $missing = [];
            if ($recordFk === null) {
                $missing[] = in_array('maintenance_projects_id', $columns, true)
                    ? 'documents link to Maintenance Projects through maintenance_projects_id, not Maintenance Records'
                    : 'no recognized MaintenanceRecord foreign key';
            }
            if ($titleField === null) {
                $missing[] = 'no recognized document-title field';
            }
            if ($nameField === null) {
                $missing[] = 'no recognized file-name field';
            }
            if ($pathField === null) {
                $missing[] = 'no recognized file-path field';
            }
            $notice = 'Record-linked documents are unavailable: ' . implode('; ', $missing)
                . '. Existing project documents have not been reclassified or changed. File uploads remain disabled pending team approval.';
        } else {
            $fields = array_values(array_unique(array_filter([
                'id', $recordFk, $titleField, $nameField, $pathField,
                $descriptionField, $uploadedByField, $uploadedAtField,
            ])));
            $documentQuery = DB::table($table);
            if ($role === 'engineer') {
                // Never reveal other Engineers' documents in this preview.
                $documentQuery->whereIn($recordFk, $records->pluck('id')->all());
            }
            $rows = $documentQuery->orderByDesc('id')->limit(200)->get($fields);
            $uploaders = collect();
            if ($uploadedByField && Schema::hasTable('user_accounts')) {
                $userIds = $rows->pluck($uploadedByField)->filter()->unique()->values()->all();
                if ($userIds) {
                    $uploaders = DB::table('user_accounts')->whereIn('id', $userIds)->pluck('username', 'id');
                }
            }
            $documents = $rows->map(static function ($row) use ($recordFk, $titleField, $nameField, $descriptionField, $uploadedByField, $uploadedAtField, $uploaders) {
                $uploaderId = $uploadedByField ? $row->{$uploadedByField} : null;
                return [
                    'id' => (int) $row->id,
                    'maintenanceRecordId' => (int) $row->{$recordFk},
                    'title' => (string) $row->{$titleField},
                    'description' => $descriptionField ? $row->{$descriptionField} : null,
                    'fileName' => (string) $row->{$nameField},
                    // Deliberately do not expose private storage paths/URLs to client.
                    'uploadedBy' => $uploaderId ? (string) ($uploaders[$uploaderId] ?? ('Account #'.$uploaderId)) : 'Not recorded',
                    'uploadedAt' => $uploadedAtField ? (string) $row->{$uploadedAtField} : null,
                ];
            })->values();
        }
    }

    $projectOptions = Schema::hasTable('maintenance_projects')
        ? DB::table('maintenance_projects')->orderBy('project_title')
        : null;
    // Project ID is not exported in the public record DTO, so obtain the
    // allowed projects by cross-referencing the scoped record IDs instead.
    if ($projectOptions !== null && $role === 'engineer') {
        $projectOptions = DB::table('maintenance_projects')->orderBy('project_title')
            ->whereIn('id', $scopedRecords->visibleQuery($user)->pluck('maintenance_projects_id')->all());
    }
    $engineerOptions = Schema::hasTable('engineers')
        ? DB::table('engineers')->orderBy('last_name')
        : null;
    if ($engineerOptions !== null && $role === 'engineer') {
        $engineerOptions->where('id', (int) ($accounts->resolve($user)?->engineers_id ?? 0));
    }

    $availableProjects = $projectOptions !== null
        ? $projectOptions->get(['id', 'project_title'])
            ->map(static fn ($project) => ['id' => (int) $project->id, 'title' => (string) $project->project_title])
            ->all()
        : [];
    $requestedProjectId = filter_var(request()->query('project'), FILTER_VALIDATE_INT);
    $initialProjectId = $requestedProjectId !== false
        && collect($availableProjects)->contains('id', (int) $requestedProjectId)
        ? (int) $requestedProjectId
        : null;

    return Inertia::render('project-documents-preview/Index', [
        'initialDocuments' => $documents->all(),
        'maintenanceRecords' => $records->all(),
        'schemaNotice' => $notice,
        'canDraft' => false,
        'canUpload' => in_array($role, ['admin', 'superadmin'], true)
            || ($role === 'engineer' && $records->isNotEmpty()),
        'canCreateRecord' => in_array($role, ['admin', 'superadmin'], true),
        'storageConfigured' => app(PrivateSupabaseStorage::class)->configured(),
        'maintenanceProjects' => $availableProjects,
        'initialProjectId' => $initialProjectId,
        'engineers' => $engineerOptions !== null
            ? $engineerOptions->get(['id', 'first_name', 'middle_name', 'last_name'])
                ->map(static fn ($e) => ['id' => (int) $e->id,
                    'name' => trim((string) $e->first_name.' '.(string) ($e->middle_name ?? '').' '.(string) $e->last_name)])->all()
            : [],
    ]);
})->name('project-documents.preview');

// Guarded upload, download and Maintenance Record prerequisite routes.
require __DIR__.'/project-documents-actions.php';
