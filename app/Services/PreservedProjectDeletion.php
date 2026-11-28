<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Services\Files\PermanentFileDeletion;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/**
 * Explicit reviewed MaintenanceProject deletion.
 *
 * Delete reviewed dependencies first. Required relationships are never detached.
 *
 * Optional historical-context support is retained for reading
 * previously detached records, not for creating new detachments.
 */
final class PreservedProjectDeletion
{
    public const CONTEXT = 'jairoads_next.maintenance_record_contexts';

    private ?bool $available = null;

    public function __construct(
        private AccountIdentityResolver $identities,
        private OperationAudit $audit,
        private PermanentFileDeletion $files
    ) {}

    /**
     * Historical-context availability only.
     *
     * This must not determine whether an empty project can be deleted.
     */
    public function available(): bool
    {
        return $this->available ??= Schema::hasTable(self::CONTEXT)
            && DB::table('information_schema.columns')
                ->where('table_schema', 'jairoads_next')
                ->where('table_name', 'maintenance_records')
                ->whereIn('column_name', [
                    'project_id',
                    'managing_engineer_id',
                ])
                ->where('is_nullable', 'YES')
                ->count() === 2;
    }

    /**
     * @return array{account_id:int,role:string,engineer_id:?int}
     */
    private function actor(User $login): array
    {
        $actor = $this->identities->resolve($login);

        abort_unless(
            $actor !== null
                && RoleAccess::managesBusinessData($actor['role']),
            403
        );

        return $actor;
    }

    /**
     * @return array<string,mixed>
     */
    private function inspect(User $login, int $id): array
    {
        $this->actor($login);

        $roadId = DB::table('jairoads_next.maintenance_projects')
            ->where('id', $id)
            ->value('road_coverage_id');

        abort_unless($roadId !== null, 404);

        // Preserve the established lock order.
        $road = DB::table('jairoads_next.road_coverages')
            ->where('id', $roadId)
            ->sharedLock()
            ->first();

        $project = DB::table('jairoads_next.maintenance_projects')
            ->where('id', $id)
            ->lockForUpdate()
            ->first();

        abort_unless(
            $road !== null
                && $project !== null
                && $project->road_coverage_id === $roadId,
            409,
            'Project changed. Refresh the preview.'
        );

        $lgu = DB::table('jairoads_next.lgus')
            ->where('id', $road->lgu_id)
            ->sharedLock()
            ->first([
                'id',
                'municipality_name',
                'province',
                'region',
            ]);

        abort_unless($lgu !== null, 404);

        $records = DB::table('jairoads_next.maintenance_records')
            ->where('project_id', $id)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        // Fail before private file preflight when retained milestones exist.
        if (Schema::hasTable('jairoads_next.maintenance_milestones')
            && DB::table('jairoads_next.maintenance_milestones')->whereIn('maintenance_id', $records->pluck('id'))->exists()) {
            throw ValidationException::withMessages([
                'confirmation_token' => 'This project has retained milestones. Project deletion is unavailable until an approved preservation workflow exists.',
            ]);
        }

        $updates = DB::table('jairoads_next.monthly_updates')
            ->whereIn('maintenance_id', $records->pluck('id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $documents = DB::table('jairoads_next.maintenance_documents')
            ->whereIn('maintenance_id', $records->pluck('id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $media = DB::table('jairoads_next.media')
            ->whereIn('monthly_update_id', $updates->pluck('id'))
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        return [
            'project' => $project,
            'road' => $road,
            'lgu' => $lgu,
            'records' => $records,
            'updates' => $updates,
            'documents' => $documents,
            'media' => $media,
            'business_fingerprint' => hash('sha256', json_encode([$project, $road, $lgu, $records, $updates,
                $documents->map(fn ($d) => array_diff_key((array) $d, array_flip(['file_name', 'file_path', 'updated_at'])))], JSON_THROW_ON_ERROR)),
            'fingerprint' => hash(
                'sha256',
                json_encode(
                    [
                        $project,
                        $road,
                        $lgu,
                        $records,
                        $updates,
                        $documents,
                        $media,
                    ],
                    JSON_THROW_ON_ERROR
                )
            ),
            'counts' => [
                'maintenance_records' => $records->count(),
                'monthly_updates' => $updates->count(),
                'maintenance_documents' => $documents->count(),
                'media' => $media->count(),
            ],
        ];
    }

    /**
     * Generate a confirmation token for the project and its reviewed dependencies.
     *
     * @return array<string,mixed>
     */
    public function preview(User $login, int $id): array
    {
        $actor = $this->actor($login);

        return DB::transaction(function () use ($login, $actor, $id): array {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');

            $impact = $this->inspect($login, $id);

            abort_unless($this->actor($login) === $actor, 403);

            return [
                'project' => [
                    'id' => $id,
                    'project_title' => $impact['project']->project_title,
                ],
                'road' => [
                    'id' => (int) $impact['road']->id,
                    'road_name' => $impact['road']->road_name,
                ],
                'counts' => $impact['counts'],
                'can_delete' => ($impact['documents']->every(fn ($d) => $d->file_path === '') && $impact['media']->isEmpty()) || $this->files->operationallyEnabled(),
                'confirmation_token' => Crypt::encryptString(
                    json_encode(
                        [
                            'actor' => $actor['account_id'],
                            'project' => $id,
                            'fingerprint' => $impact['fingerprint'],
                            'expires' => time() + 900,
                        ],
                        JSON_THROW_ON_ERROR
                    )
                ),
            ];
        });
    }

    /**
     * Delete reviewed project data after confirmation.
     *
     * Never detach MaintenanceRecords or clear required foreign keys.
     */
    public function confirm(User $login, int $id, string $token): void
    {
        $actor = $this->actor($login);

        try {
            $claim = json_decode(
                Crypt::decryptString($token),
                true,
                512,
                JSON_THROW_ON_ERROR
            );
        } catch (\Throwable) {
            $this->stale();
        }

        if (
            ! is_array($claim)
            || ($claim['actor'] ?? null) !== $actor['account_id']
            || ($claim['project'] ?? null) !== $id
            || ! is_int($claim['expires'] ?? null)
            || $claim['expires'] < time()
            || ! is_string($claim['fingerprint'] ?? null)
        ) {
            $this->stale();
        }

        $approved = DB::transaction(function () use ($login, $actor, $id, $claim): array {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');

            $impact = $this->inspect($login, $id);

            $account = DB::table('jairoads_next.user_accounts')
                ->where('id', $actor['account_id'])
                ->sharedLock()
                ->first(['engineer_id']);

            if ($account?->engineer_id !== null) {
                DB::table('jairoads_next.engineers')
                    ->where('id', $account->engineer_id)
                    ->sharedLock()
                    ->first(['id']);
            }

            abort_unless($this->actor($login) === $actor, 403);

            if (
                $claim['expires'] < time()
                || ! hash_equals(
                    $claim['fingerprint'],
                    $impact['fingerprint']
                )
            ) {
                $this->stale();
            }

            return $impact;
        });

        // Each file has its own durable deletion intent. Do not wrap external
        // Storage operations in the parent SQL transaction.
        $targets = [];
        foreach (['media' => 'media', 'documents' => 'document'] as $key => $kind) {
            foreach ($approved[$key] as $file) {
                if ($kind !== 'document' || $file->file_path !== '') {
                    $targets[] = [$kind, $file];
                }
            }
        }
        if ($targets !== []) {
            abort_unless($this->files->operationallyEnabled(), 503, 'Private file deletion is unavailable. No project deletion has started.');
            foreach ($targets as [$kind, $file]) {
                $this->files->preflight($login, $kind, (int) $file->id, (string) $file->file_path);
            }
            foreach ($targets as [$kind, $file]) {
                abort_unless($this->actor($login) === $actor, 403);
                $result = $this->files->delete($login, $kind, (int) $file->id, (string) $file->file_path);
                if ($result['state'] !== 'completed') {
                    throw ValidationException::withMessages([
                        'confirmation_token' => 'A file deletion is pending. The project and maintenance records remain. Some approved files may already be deleted; refresh the preview to retry.',
                    ]);
                }
            }
        }

        DB::transaction(function () use ($login, $actor, $id, $approved): void {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
            $impact = $this->inspect($login, $id);
            $account = DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->sharedLock()->first(['engineer_id']);
            if ($account?->engineer_id !== null) {
                DB::table('jairoads_next.engineers')->where('id', $account->engineer_id)->sharedLock()->first(['id']);
            }
            abort_unless($this->actor($login) === $actor, 403);
            if (! hash_equals($approved['business_fingerprint'], $impact['business_fingerprint'])
                || $impact['media']->isNotEmpty()
                || $impact['documents']->contains(fn ($d) => $d->file_path !== '' || $d->file_name !== '')
                || $impact['documents']->pluck('id')->all() !== $approved['documents']->pluck('id')->all()) {
                throw ValidationException::withMessages([
                    'confirmation_token' => 'Project data changed during deletion. The project and maintenance records remain; refresh to review remaining data. Approved files already removed cannot be restored.',
                ]);
            }
            foreach (['documents' => ['maintenance_documents', 'MaintenanceDocument'], 'updates' => ['monthly_updates', 'MonthlyUpdate'], 'records' => ['maintenance_records', 'MaintenanceRecord']] as $key => [$table, $entity]) {
                foreach ($impact[$key] as $row) {
                    $childId = (int) $row->id;
                    $query = DB::table('jairoads_next.'.$table)->where('id', $childId);
                    abort_unless($query->delete() === 1 && ! $query->exists(), 409, 'A related record could not be deleted.');
                    $this->audit->record($actor, 'DELETE', $entity, $childId, 'Deleted as part of confirmed MaintenanceProject deletion.', [], (array) $row);
                }
            }
            // The database's restrictive foreign keys remain authoritative.
            try {
                abort_unless(
                    DB::table('jairoads_next.maintenance_projects')
                        ->where('id', $id)
                        ->delete() === 1,
                    409
                );
            } catch (QueryException $exception) {
                // An unrelated database failure must remain a server error.
                // Only PostgreSQL foreign-key violations are user-facing conflicts.
                if (($exception->errorInfo[0] ?? null) !== '23503') {
                    throw $exception;
                }

                throw ValidationException::withMessages([
                    'confirmation_token' => 'This project is still referenced and cannot be deleted.',
                ]);
            }

            // Record only a successful, authorized deletion.
            $this->audit->record(
                $actor,
                'DELETE',
                'MaintenanceProject',
                $id,
                'MaintenanceProject and reviewed dependent data deleted.',
                [],
                (array) $impact['project']
            );
        }, 3);
    }

    private function stale(): never
    {
        throw ValidationException::withMessages([
            'confirmation_token' => 'The project or related history changed. Close and refresh the deletion preview.',
        ]);
    }
}
