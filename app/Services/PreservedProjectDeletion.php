<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/**
 * Restrictive MaintenanceProject deletion.
 *
 * A project may be deleted only when it has no dependent
 * MaintenanceRecords. Required relationships are never detached.
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
        private OperationAudit $audit
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
     * Generate a confirmation token only for an empty project.
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

            // Final DD: a referenced parent cannot be deleted.
            abort_if(
                $impact['records']->isNotEmpty(),
                409,
                'This project has MaintenanceRecords and cannot be deleted.'
            );

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
     * Delete only an empty MaintenanceProject after confirmation.
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

        DB::transaction(function () use (
            $login,
            $actor,
            $id,
            $claim
        ): void {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');

            $impact = $this->inspect($login, $id);

            // Never remove a project while records still reference it.
            abort_if(
                $impact['records']->isNotEmpty(),
                409,
                'This project has MaintenanceRecords and cannot be deleted.'
            );

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
                'Empty MaintenanceProject deleted after restrictive FK validation.',
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
