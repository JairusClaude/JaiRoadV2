
<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMediaRequest;
use App\Http\Requests\UpdateMediaRequest;
use App\Models\AuditLog;
use App\Models\MaintenanceRecord;
use App\Models\Media;
use App\Models\MonthlyUpdate;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MediaController extends Controller
{
    /**
     * Fields included in Media audit snapshots.
     */
    private const AUDITABLE_FIELDS = [
        'monthly_update_id',
        'file_name',
        'file_path',
        'file_type',
        'uploaded_by',
        'created_at',
    ];

    /**
     * Display Media records.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', Media::class);

        $actorAccount = $this->authenticatedUserAccount();

        $search = trim((string) request()->query('search', ''));

        $sortField = (string) request()->query(
            'sort_field',
            'created_at'
        );

        $sortDirection = strtolower(
            (string) request()->query('sort_direction', 'desc')
        );

        $allowedSortFields = [
            'file_name',
            'file_type',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = Media::query()->with([
            'monthlyUpdate',
            'uploadedBy',
        ]);

        /*
         * The MediaPolicy must grant viewAll only to roles
         * permitted to view the complete Media collection.
         */
        if (! Gate::allows('viewAll', Media::class)) {
            $this->scopeToAssignedMaintenance($query, $actorAccount);
        }

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('file_name', 'like', $like)
                    ->orWhere('file_type', 'like', $like)
                    ->orWhereHas(
                        'monthlyUpdate',
                        fn (Builder $updateQuery) => $updateQuery
                            ->where('update_month', 'like', $like)
                    );
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Media/Index', [
            'model' => $model,
            'monthlyUpdates' => $this->availableMonthlyUpdates(),
            'queryParams' => request()->query(),
        ]);
    }

    /**
     * Display the form for uploading Media.
     */
    public function create(): Response
    {
        Gate::authorize('create', Media::class);

        return Inertia::render('Media/Create', [
            'monthlyUpdates' => $this->availableMonthlyUpdates(),
        ]);
    }

    /**
     * Upload photo/video evidence and register its metadata.
     */
    public function store(StoreMediaRequest $request): RedirectResponse
    {
        Gate::authorize('create', Media::class);

        $actorAccount = $this->authenticatedUserAccount();

        $data = $request->safe()->only([
            'monthly_update_id',
        ]);

        $monthlyUpdate = MonthlyUpdate::query()
            ->findOrFail($data['monthly_update_id']);

        /*
         * This custom policy ability must verify that an Engineer
         * manages the associated MaintenanceRecord and has the
         * required active EngineerLGU assignment.
         */
        Gate::authorize(
            'createForMonthlyUpdate',
            [Media::class, $monthlyUpdate]
        );

        $file = $request->file('file');

        abort_if($file === null, 422, 'A media file is required.');

        $directory = 'maintenance-media/'
            .$monthlyUpdate->getKey();

        $path = $file->store($directory, 'supabase');

        if ($path === false) {
            abort(500, 'The media file could not be uploaded.');
        }

        try {
            DB::transaction(function () use (
                $data,
                $file,
                $path,
                $actorAccount
            ): void {
                $media = Media::create([
                    'monthly_update_id' => $data['monthly_update_id'],
                    'file_name' => $file->getClientOriginalName(),
                    'file_path' => $path,
                    'file_type' => $file->getMimeType(),
                    'uploaded_by' => $actorAccount->getKey(),
                ]);

                $this->writeAuditLog(
                    $actorAccount,
                    'CREATE',
                    $media,
                    null,
                    $this->auditValues($media)
                );
            });
        } catch (Throwable $exception) {
            // Prevent an orphaned upload if the database operation fails.
            Storage::disk('supabase')->delete($path);

            throw $exception;
        }

        return to_route('media.index')
            ->with('message', 'Successfully uploaded media evidence.');
    }

    /**
     * Display Media metadata.
     */
    public function show(Media $media): Response
    {
        Gate::authorize('view', $media);

        $media->load([
            'monthlyUpdate',
            'uploadedBy',
        ]);

        return Inertia::render('Media/Show', [
            'media' => $media,
        ]);
    }

    /**
     * Display the form for replacing a Media file.
     */
    public function edit(Media $media): Response
    {
        Gate::authorize('update', $media);

        $media->load('monthlyUpdate');

        return Inertia::render('Media/Edit', [
            'media' => $media,
        ]);
    }

    /**
     * Replace the stored photo/video file.
     *
     * The existing MonthlyUpdate association is preserved.
     */
    public function update(
        UpdateMediaRequest $request,
        Media $media
    ): RedirectResponse {
        Gate::authorize('update', $media);

        $actorAccount = $this->authenticatedUserAccount();

        $file = $request->file('file');

        abort_if($file === null, 422, 'A replacement media file is required.');

        $monthlyUpdate = MonthlyUpdate::query()
            ->findOrFail($media->monthly_update_id);

        Gate::authorize(
            'createForMonthlyUpdate',
            [Media::class, $monthlyUpdate]
        );

        $newPath = $file->store(
            'maintenance-media/'.$monthlyUpdate->getKey(),
            'supabase'
        );

        if ($newPath === false) {
            abort(500, 'The replacement media file could not be uploaded.');
        }

        $oldPath = $media->file_path;

        try {
            DB::transaction(function () use (
                $media,
                $file,
                $newPath,
                $actorAccount
            ): void {
                $record = Media::query()
                    ->lockForUpdate()
                    ->findOrFail($media->getKey());

                Gate::authorize('update', $record);

                $oldValues = $this->auditValues($record);

                $record->fill([
                    'file_name' => $file->getClientOriginalName(),
                    'file_path' => $newPath,
                    'file_type' => $file->getMimeType(),
                    'uploaded_by' => $actorAccount->getKey(),
                ]);

                $changedFields = array_values(array_intersect(
                    self::AUDITABLE_FIELDS,
                    array_keys($record->getDirty())
                ));

                if ($changedFields === []) {
                    return;
                }

                $changedKeys = array_flip($changedFields);

                $oldValues = array_intersect_key(
                    $oldValues,
                    $changedKeys
                );

                $record->save();

                $newValues = array_intersect_key(
                    $this->auditValues($record),
                    $changedKeys
                );

                $this->writeAuditLog(
                    $actorAccount,
                    'UPDATE',
                    $record,
                    $oldValues,
                    $newValues
                );
            });
        } catch (Throwable $exception) {
            // The previous file is untouched; remove the failed replacement.
            Storage::disk('supabase')->delete($newPath);

            throw $exception;
        }

        /*
         * Storage is external to the database transaction.
         * Remove the old object only after the database commit succeeds.
         */
        try {
            $oldFileRemoved = $oldPath === $newPath
                || Storage::disk('supabase')->delete($oldPath);
        } catch (Throwable) {
            $oldFileRemoved = false;
        }

        if (! $oldFileRemoved) {
            return to_route(
                'media.index',
                $request->query()
            )->with(
                'warning',
                'The media record was updated, but the old storage file '
                .'could not be removed. Check Supabase Storage for cleanup.'
            );
        }

        return to_route(
            'media.index',
            $request->query()
        )->with('message', 'Successfully updated media evidence.');
    }

    /**
     * Download the file after authorization.
     */
    public function download(Media $media): StreamedResponse
    {
        Gate::authorize('view', $media);

        abort_unless(
            Storage::disk('supabase')->exists($media->file_path),
            404,
            'The media file could not be found in storage.'
        );

        return Storage::disk('supabase')->download(
            $media->file_path,
            $media->file_name
        );
    }

    /**
     * Delete Media metadata and the associated stored object.
     * Only Admin/SuperAdmin should be authorized by the policy.
     */
    public function destroy(Media $media): RedirectResponse
    {
        Gate::authorize('delete', $media);

        $actorAccount = $this->authenticatedUserAccount();

        $filePath = $media->file_path;

        DB::transaction(function () use (
            $media,
            $actorAccount
        ): void {
            $record = Media::query()
                ->lockForUpdate()
                ->findOrFail($media->getKey());

            Gate::authorize('delete', $record);

            $oldValues = $this->auditValues($record);

            $record->delete();

            $this->writeAuditLog(
                $actorAccount,
                'DELETE',
                $record,
                $oldValues,
                null
            );
        });

        /*
         * Delete the storage object only after the database transaction
         * succeeds. Storage operations cannot participate in DB rollback.
         */
        try {
            $fileRemoved = Storage::disk('supabase')->delete($filePath);
        } catch (Throwable) {
            $fileRemoved = false;
        }

        if (! $fileRemoved) {
            return to_route('media.index')
                ->with(
                    'warning',
                    'The Media database record was deleted, but its storage '
                    .'file could not be removed. Check Supabase Storage.'
                );
        }

        return to_route('media.index')
            ->with('message', 'Successfully deleted media evidence.');
    }

    /**
     * Return monthly updates the current user may select.
     */
    private function availableMonthlyUpdates()
    {
        $actorAccount = $this->authenticatedUserAccount();

        $query = MonthlyUpdate::query()
            ->with('maintenanceRecord.maintenanceProject')
            ->orderByDesc('update_month');

        if (! Gate::allows('viewAll', Media::class)) {
            if ($actorAccount->engineer_id === null) {
                $query->whereRaw('1 = 0');
            } else {
                $this->scopeToAssignedMaintenance(
                    $query,
                    $actorAccount
                );
            }
        }

        return $query->get();
    }

    /**
     * Restrict records to MaintenanceRecords managed by the Engineer
     * who also has an active assignment to the related LGU.
     *
     * These relationship names and foreign-key columns must match
     * the application's actual models and migrations.
     */
    private function scopeToAssignedMaintenance(
        Builder $query,
        UserAccount $actorAccount
    ): void {
        if ($actorAccount->engineer_id === null) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->whereHas(
            'monthlyUpdate.maintenanceRecord',
            function (Builder $recordQuery) use ($actorAccount): void {
                $recordQuery
                    ->where(
                        'managing_engineer_id',
                        $actorAccount->engineer_id
                    )
                    ->whereHas(
                        'maintenanceProject.roadCoverage.lgu.engineerAssignments',
                        fn (Builder $assignmentQuery) => $assignmentQuery
                            ->where(
                                'engineer_id',
                                $actorAccount->engineer_id
                            )
                            ->where('is_active', true)
                    );
            }
        );
    }

    /**
     * Resolve the authenticated user to the associated UserAccount.
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
     * Get fields included in the audit snapshot.
     *
     * @return array<string, mixed>
     */
    private function auditValues(Media $media): array
    {
        return array_intersect_key(
            $media->getAttributes(),
            array_flip(self::AUDITABLE_FIELDS)
        );
    }

    /**
     * Write an audit event in the same transaction as the database change.
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    private function writeAuditLog(
        UserAccount $actorAccount,
        string $action,
        Media $media,
        ?array $oldValues,
        ?array $newValues
    ): void {
        $description = match ($action) {
            'CREATE' => "Media #{$media->getKey()} was uploaded.",
            'UPDATE' => "Media #{$media->getKey()} was updated.",
            'DELETE' => "Media #{$media->getKey()} was deleted.",
            default => "Media #{$media->getKey()} changed.",
        };

        AuditLog::create([
            'user_id' => $actorAccount->getKey(),
            'actor_identifier' => 'UserAccount#'
                .$actorAccount->getKey(),
            'action' => $action,
            'entity_type' => 'Media',
            'entity_id' => $media->getKey(),
            'description' => $description,
            'old_value' => $oldValues,
            'new_value' => $newValues,
            'recipient_user_id' => null,
            'notification_message' => null,
        ]);
    }
}
