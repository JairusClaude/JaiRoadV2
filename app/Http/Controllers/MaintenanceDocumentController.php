<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenanceDocumentRequest;
use App\Http\Requests\UpdateMaintenanceDocumentRequest;
use App\Models\AuditLog;
use App\Models\MaintenanceDocument;
use App\Models\MaintenanceRecord;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class MaintenanceDocumentController extends Controller
{
    /**
     * Fields included in audit snapshots.
     */
    private const AUDITABLE_FIELDS = [
        'maintenance_id',
        'document_title',
        'description',
        'file_name',
        'file_path',
        'uploaded_by',
        'uploaded_at',
    ];

    /**
     * Display maintenance documents.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $actorAccount = $this->authenticatedUserAccount();

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'uploaded_at'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'desc')
        );

        $allowedSortFields = [
            'document_title',
            'file_name',
            'uploaded_at',
            'updated_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'uploaded_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = MaintenanceDocument::query()->with([
            'maintenanceRecord.maintenanceProject',
            'uploadedBy',
        ]);

        /*
         * MaintenanceDocumentPolicy::viewAll must grant access
         * only to roles permitted to view the complete document list.
         */
        if (! Gate::allows('viewAll', MaintenanceDocument::class)) {
            if ($actorAccount->engineer_id === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas(
                    'maintenanceRecord',
                    fn (Builder $recordQuery) => $recordQuery->where(
                        'managing_engineer_id',
                        $actorAccount->engineer_id
                    )
                );
            }
        }

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%' . $search . '%';

                $query->where('document_title', 'like', $like)
                    ->orWhere('file_name', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhereHas(
                        'maintenanceRecord',
                        fn (Builder $recordQuery) => $recordQuery
                            ->whereHas(
                                'maintenanceProject',
                                fn (Builder $projectQuery) => $projectQuery
                                    ->where('project_title', 'like', $like)
                            )
                    );
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('MaintenanceDocuments/Index', [
            'model' => $model,
            'maintenanceRecords' => $this->availableMaintenanceRecords(),
            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Display the create form.
     */
    public function create(): Response
    {
        Gate::authorize('create', MaintenanceDocument::class);

        return Inertia::render('MaintenanceDocuments/Create', [
            'maintenanceRecords' => $this->availableMaintenanceRecords(),
        ]);
    }

    /**
     * Upload and register a maintenance document.
     */
    public function store(
        StoreMaintenanceDocumentRequest $request
    ): RedirectResponse {
        Gate::authorize('create', MaintenanceDocument::class);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'maintenance_id',
            'document_title',
            'description',
        ]);

        $maintenanceRecord = MaintenanceRecord::query()
            ->findOrFail($data['maintenance_id']);

        /*
         * This policy ability must verify the selected record's
         * Engineer/LGU assignment permissions.
         */
        Gate::authorize(
            'createForRecord',
            [MaintenanceDocument::class, $maintenanceRecord]
        );

        $file = $request->file('file');

        abort_if($file === null, 422, 'A document file is required.');

        $directory = 'maintenance-documents/'
            . $maintenanceRecord->getKey();

        $path = $file->store($directory, 'supabase');

        if ($path === false) {
            abort(500, 'The document could not be uploaded.');
        }

        try {
            DB::transaction(function () use (
                $data,
                $file,
                $path,
                $actorAccount
            ): void {
                $document = MaintenanceDocument::create([
                    ...$data,
                    'file_name' => $file->getClientOriginalName(),
                    'file_path' => $path,
                    'uploaded_by' => $actorAccount->getKey(),
                    'uploaded_at' => now(),
                ]);

                $this->writeAuditLog(
                    $actorAccount,
                    'CREATE',
                    $document,
                    null,
                    $this->auditValues($document)
                );
            });
        } catch (Throwable $exception) {
            // Remove the new upload if the database operation fails.
            Storage::disk('supabase')->delete($path);

            throw $exception;
        }

        return to_route('maintenance-documents.index')
            ->with(
                'message',
                'Successfully uploaded a maintenance document.'
            );
    }

    /**
     * Display a document's metadata.
     */
    public function show(
        MaintenanceDocument $maintenanceDocument
    ): Response {
        Gate::authorize('view', $maintenanceDocument);

        $maintenanceDocument->load([
            'maintenanceRecord.maintenanceProject',
            'uploadedBy',
        ]);

        return Inertia::render('MaintenanceDocuments/Show', [
            'maintenanceDocument' => $maintenanceDocument,
        ]);
    }

    /**
     * Display the edit form.
     */
    public function edit(
        MaintenanceDocument $maintenanceDocument
    ): Response {
        Gate::authorize('update', $maintenanceDocument);

        $maintenanceDocument->load([
            'maintenanceRecord.maintenanceProject',
        ]);

        return Inertia::render('MaintenanceDocuments/Edit', [
            'maintenanceDocument' => $maintenanceDocument,
        ]);
    }

    /**
     * Update document metadata and optionally replace the file.
     */
    public function update(
        UpdateMaintenanceDocumentRequest $request,
        MaintenanceDocument $maintenanceDocument
    ): RedirectResponse {
        Gate::authorize('update', $maintenanceDocument);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'document_title',
            'description',
        ]);

        $file = $request->file('file');
        $newPath = null;

        if ($file !== null) {
            $directory = 'maintenance-documents/'
                . $maintenanceDocument->maintenance_id;

            $newPath = $file->store($directory, 'supabase');

            if ($newPath === false) {
                abort(500, 'The replacement document could not be uploaded.');
            }

            $data['file_name'] = $file->getClientOriginalName();
            $data['file_path'] = $newPath;
            $data['uploaded_by'] = $actorAccount->getKey();
            $data['uploaded_at'] = now();
        }

        try {
            DB::transaction(function () use (
                $maintenanceDocument,
                $data,
                $actorAccount
            ): void {
                $document = MaintenanceDocument::query()
                    ->lockForUpdate()
                    ->findOrFail($maintenanceDocument->getKey());

                Gate::authorize('update', $document);

                $oldValues = $this->auditValues($document);

                $document->fill($data);

                $changedFields = array_values(array_intersect(
                    self::AUDITABLE_FIELDS,
                    array_keys($document->getDirty())
                ));

                // An unchanged submission should not create an audit event.
                if ($changedFields === []) {
                    return;
                }

                $changedKeys = array_flip($changedFields);

                $oldValues = array_intersect_key(
                    $oldValues,
                    $changedKeys
                );

                $document->save();

                $newValues = array_intersect_key(
                    $this->auditValues($document),
                    $changedKeys
                );

                $this->writeAuditLog(
                    $actorAccount,
                    'UPDATE',
                    $document,
                    $oldValues,
                    $newValues
                );
            });
        } catch (Throwable $exception) {
            if ($newPath !== null) {
                Storage::disk('supabase')->delete($newPath);
            }

            throw $exception;
        }

        /*
         * Do not delete the previous storage object automatically:
         * the document-retention rule is still undecided.
         */

        return to_route(
            'maintenance-documents.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated the maintenance document.'
        );
    }

    /**
     * Download the stored file after authorization.
     */
    public function download(
        MaintenanceDocument $maintenanceDocument
    ) {
        Gate::authorize('view', $maintenanceDocument);

        return Storage::disk('supabase')->download(
            $maintenanceDocument->file_path,
            $maintenanceDocument->file_name
        );
    }

    /**
     * Delete document metadata. Physical file retention is still TBD.
     */
    public function destroy(
        MaintenanceDocument $maintenanceDocument
    ): RedirectResponse {
        Gate::authorize('delete', $maintenanceDocument);

        $actorAccount = $this->authenticatedUserAccount();

        DB::transaction(function () use (
            $maintenanceDocument,
            $actorAccount
        ): void {
            $document = MaintenanceDocument::query()
                ->lockForUpdate()
                ->findOrFail($maintenanceDocument->getKey());

            Gate::authorize('delete', $document);

            $oldValues = $this->auditValues($document);

            $document->delete();

            $this->writeAuditLog(
                $actorAccount,
                'DELETE',
                $document,
                $oldValues,
                null
            );
        });

        /*
         * The metadata is deleted, but the physical Supabase object
         * is deliberately retained until the retention policy is decided.
         */

        return to_route('maintenance-documents.index')
            ->with(
                'message',
                'Successfully deleted the maintenance document metadata. '
                . 'The stored file was retained.'
            );
    }

    /**
     * Return maintenance records the current user may select.
     */
    private function availableMaintenanceRecords()
    {
        $actorAccount = $this->authenticatedUserAccount();

        $query = MaintenanceRecord::query()
            ->with('maintenanceProject')
            ->orderByDesc('maintenance_year')
            ->orderBy('quarter');

        if (! Gate::allows('viewAll', MaintenanceDocument::class)) {
            if ($actorAccount->engineer_id === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->where(
                    'managing_engineer_id',
                    $actorAccount->engineer_id
                );
            }
        }

        return $query->get();
    }

    /**
     * Resolve the authenticated user to the correct UserAccount.
     */
    private function authenticatedUserAccount(): UserAccount
    {
        $user = Auth::user();

        if ($user instanceof UserAccount) {
            return $user;
        }

        if ($user !== null && method_exists($user, 'userAccount')) {
            $account = $user->userAccount;

            if ($account instanceof UserAccount) {
                return $account;
            }
        }

        abort(
            403,
            'The authenticated user is not linked to a UserAccount.'
        );
    }

    /**
     * Select fields for a document audit snapshot.
     *
     * @return array<string, mixed>
     */
    private function auditValues(
        MaintenanceDocument $document
    ): array {
        return array_intersect_key(
            $document->getAttributes(),
            array_flip(self::AUDITABLE_FIELDS)
        );
    }

    /**
     * Write the audit event in the same database transaction.
     *
     * @param array<string, mixed>|null $oldValues
     * @param array<string, mixed>|null $newValues
     */
    private function writeAuditLog(
        UserAccount $actorAccount,
        string $action,
        MaintenanceDocument $document,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $description = match ($action) {
            'CREATE' => "Maintenance document #{$document->getKey()} was uploaded.",
            'UPDATE' => "Maintenance document #{$document->getKey()} was updated.",
            'DELETE' => "Maintenance document #{$document->getKey()} metadata was deleted.",
            default => "Maintenance document #{$document->getKey()} changed.",
        };

        AuditLog::create([
            'user_id' => $actorAccount->getKey(),
            'actor_identifier' => 'UserAccount#'
                . $actorAccount->getKey(),
            'action' => $action,
            'entity_type' => 'MaintenanceDocument',
            'entity_id' => $document->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'recipient_user_id' => null,
            'notification_message' => null,
        ]);
    }
}
