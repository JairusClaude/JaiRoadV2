<?php

declare(strict_types=1);

namespace App\Services\Files;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdOperationAudit;
use App\Services\DataDictionary\DdRoleAccess;
use App\Services\DataDictionary\PreservedProjectDeletion;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/** Durable approved commands, not a pretend SQL/Storage distributed transaction. */
final class PermanentFileDeletion
{
    private const TABLE = 'jairoads_next.file_deletions';

    private ?bool $available = null;

    public function __construct(private DataDictionaryIdentityResolver $identities, private PrivateSupabaseStorage $documents,
        private PrivateMonthlyMediaStorage $media, private DdOperationAudit $audit) {}

    public function available(): bool
    {
        return $this->available ??= Schema::hasTable(self::TABLE);
    }

    /** @return array{account_id:int,role:string,engineer_id:?int} */
    private function actor(User $login): array
    {
        $actor = $this->identities->resolve($login);
        abort_unless($actor !== null && DdRoleAccess::managesBusinessData($actor['role']), 403);

        return $actor;
    }

    private function table(string $kind): string
    {
        abort_unless(in_array($kind, ['document', 'media'], true), 404);

        return 'jairoads_next.'.($kind === 'document' ? 'maintenance_documents' : 'media');
    }

    private function file(string $kind, int $id): Builder
    {
        $q = DB::table($this->table($kind).' as f');
        if ($kind === 'media') {
            $q->join('jairoads_next.monthly_updates as mu', 'mu.id', '=', 'f.monthly_update_id');
        }

        return $q->where('f.id', $id)->select(['f.id', 'f.file_name', 'f.file_path', $kind === 'document' ? 'f.maintenance_id' : 'mu.maintenance_id'])
            ->when($kind === 'media', fn (Builder $q) => $q->addSelect('f.monthly_update_id'));
    }

    private function storage(string $kind): PrivateSupabaseStorage|PrivateMonthlyMediaStorage
    {
        return $kind === 'document' ? $this->documents : $this->media;
    }

    private function parentExists(int $id): void
    {
        // Managers have the same global business scope as existing recordScope;
        // Engineers are rejected above, never upgraded by supplying an LGU/role.
        $record = DB::table('jairoads_next.maintenance_records')->where('id', $id)->first(['project_id']);
        if ($record !== null && $record->project_id === null) {
            abort_unless(app(PreservedProjectDeletion::class)->available() && DB::table(PreservedProjectDeletion::CONTEXT)->where('maintenance_id', $id)->exists(), 404);

            return; // Caller has already verified Admin/SuperAdmin; history stays private.
        }
        abort_unless(DB::table('jairoads_next.maintenance_records as m')->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')->where('m.id', $id)->exists(), 404);
    }

    /** @return array<string,mixed> */
    public function review(User $login, string $kind, int $id): array
    {
        $this->actor($login);
        $row = $this->file($kind, $id)->first();
        abort_unless($row !== null, 404);
        $this->parentExists((int) $row->maintenance_id);
        $enabled = $this->available();
        $pending = $enabled && DB::table(self::TABLE)->where('kind', $kind)->where('entity_id', $id)->where('state', 'pending')->exists();

        return ['id' => $id, 'kind' => $kind, 'file_name' => $row->file_name,
            'maintenance_id' => (int) $row->maintenance_id, 'monthly_update_id' => $row->monthly_update_id ?? null,
            'pending' => $pending, 'can_delete' => $enabled, 'policy_status' => $enabled ? 'permanent_individual_deletion' : 'pending_schema_owner',
            'message' => $enabled ? 'Only this selected file and its private Storage object will be permanently removed.' : 'Permanent file deletion is temporarily unavailable.',
            'delete_url' => $enabled ? '/dd-phase3/files/'.$kind.'/'.$id : null];
    }

    /** @return array{state:string,message:string} */
    public function delete(User $login, string $kind, int $id): array
    {
        $this->actor($login);
        $this->table($kind);
        abort_unless($this->available(), 503, 'Permanent file deletion is temporarily unavailable.');
        // Preserve a durable request before external I/O. Every attempt also
        // checks live authority; another active administrator may explicitly
        // reconfirm a blocked request, preserving its original initiator.
        $operation = DB::transaction(function () use ($login, $kind, $id): int {
            DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
            $existing = DB::table(self::TABLE)->where('kind', $kind)->where('entity_id', $id)->first(['id']);
            if ($existing !== null) {
                $locked = DB::table(self::TABLE)->where('id', $existing->id)->lock('FOR UPDATE SKIP LOCKED')->first();
                $actor = $this->actor($login);
                if ($locked !== null && $locked->state === 'pending') {
                    DB::table(self::TABLE)->where('id', $existing->id)->update(['requested_by' => $actor['account_id'], 'actor_role' => $actor['role'], 'actor_identifier' => 'DD-UserAccount#'.$actor['account_id']]);
                }

                return (int) $existing->id;
            }
            $row = $this->file($kind, $id)->lock('FOR UPDATE OF f')->first();
            if ($row === null) {
                $existing = DB::table(self::TABLE)->where('kind', $kind)->where('entity_id', $id)->first(['id']);
                abort_unless($existing !== null, 404);

                return (int) $existing->id;
            }
            $actor = $this->actor($login); // Recheck after any lock wait.
            $this->parentExists((int) $row->maintenance_id);
            $storage = $this->storage($kind);
            abort_unless($storage->configured(), 503, 'Permanent file deletion is temporarily unavailable.');
            try {
                $location = $storage->permanentLocation((string) $row->file_path, (int) ($row->monthly_update_id ?? $row->maintenance_id));
                $this->exclusiveObject($kind, $id, $row->file_path);
            } catch (\RuntimeException) {
                throw ValidationException::withMessages(['file' => 'This file requires administrator review before deletion.']);
            }
            // Another request may have waited for the same metadata lock.
            $existing = DB::table(self::TABLE)->where('kind', $kind)->where('entity_id', $id)->first(['id']);
            if ($existing !== null) {
                return (int) $existing->id;
            }

            return (int) DB::table(self::TABLE)->insertGetId(['kind' => $kind, 'entity_id' => $id,
                'initiated_by' => $actor['account_id'], 'requested_by' => $actor['account_id'], 'actor_role' => $actor['role'], 'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'],
                'maintenance_id' => (int) $row->maintenance_id, 'monthly_update_id' => $row->monthly_update_id ?? null,
                'file_name' => $row->file_name, 'object_path' => $row->file_path, 'storage_origin' => $location['origin'], 'bucket' => $location['bucket']]);
        });

        return $this->process($operation);
    }

    private function exclusiveObject(string $kind, int $id, string $path): void
    {
        if (DB::table($this->table($kind))->where('file_path', $path)->where('id', '!=', $id)->exists()) {
            throw new \RuntimeException('shared_object_reference');
        }
    }

    /** Only called for durable, previously accepted commands; never browser paths.
     * @return array{state:string,message:string}
     */
    public function process(int $operation): array
    {
        $stage = 'verify';
        try {
            return DB::transaction(function () use ($operation, &$stage): array {
                DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
                $intent = DB::table(self::TABLE)->where('id', $operation)->lock('FOR UPDATE SKIP LOCKED')->first();
                if ($intent === null) {
                    return $this->pending(); // Another request/worker owns it.
                }
                if ($intent->state === 'completed') {
                    if (DB::table($this->table($intent->kind))->where('id', $intent->entity_id)->exists()) {
                        throw new \RuntimeException('target_changed'); // Never claim success for a reused/corrupt entity ID.
                    }

                    return ['state' => 'completed', 'message' => 'File permanently deleted: '.$intent->file_name];
                }
                $row = $this->file($intent->kind, (int) $intent->entity_id)->lock('FOR UPDATE OF f')->first();
                if ($row !== null && ((string) $row->file_path !== $intent->object_path || (string) $row->file_name !== $intent->file_name
                    || (int) $row->maintenance_id !== (int) $intent->maintenance_id || ($row->monthly_update_id ?? null) !== $intent->monthly_update_id)) {
                    throw new \RuntimeException('target_changed');
                }
                $account = DB::table('jairoads_next.user_accounts')->where('id', $intent->requested_by)->sharedLock()->first(['engineer_id']);
                abort_unless($account !== null, 403);
                if ($account->engineer_id !== null) {
                    DB::table('jairoads_next.engineers')->where('id', $account->engineer_id)->sharedLock()->first(['id']);
                }
                $login = User::where('dd_user_account_id', $intent->requested_by)->first();
                abort_unless($login instanceof User, 403);
                $actor = $this->actor($login);
                abort_unless($actor['role'] === $intent->actor_role, 403);
                $storage = $this->storage($intent->kind);
                $location = $storage->permanentLocation($intent->object_path, (int) ($intent->monthly_update_id ?? $intent->maintenance_id));
                if ($location['origin'] !== $intent->storage_origin || $location['bucket'] !== $intent->bucket) {
                    throw new \RuntimeException('storage_configuration_changed');
                }
                $this->exclusiveObject($intent->kind, (int) $intent->entity_id, $intent->object_path);
                $old = $row === null ? ['id' => (int) $intent->entity_id, 'file_name' => $intent->file_name, 'maintenance_id' => (int) $intent->maintenance_id, 'monthly_update_id' => $intent->monthly_update_id] : (array) $row;
                $stage = 'storage';
                $storage->removePermanently($intent->object_path);
                $stage = 'finalize';
                DB::table($this->table($intent->kind))->where('id', $intent->entity_id)->delete();
                if (DB::table($this->table($intent->kind))->where('id', $intent->entity_id)->exists()) {
                    throw new \RuntimeException('Metadata removal was not confirmed.');
                }
                $this->audit->record($actor,
                    'DELETE', $intent->kind === 'document' ? 'MaintenanceDocument' : 'Media', (int) $intent->entity_id,
                    'Selected file permanently removed from private Storage and canonical metadata.', [],
                    $old + ['initiated_by' => (int) $intent->initiated_by]);
                DB::table(self::TABLE)->where('id', $operation)->update(['state' => 'completed', 'completed_at' => now(),
                    'attempts' => DB::raw('attempts + 1'), 'last_error_code' => null, 'object_path' => null, 'storage_origin' => null, 'bucket' => null]);

                return ['state' => 'completed', 'message' => 'File permanently deleted: '.$intent->file_name];
            });
        } catch (\Throwable $error) {
            // Metadata/audit/completion rolled back. The PREVIOUSLY COMMITTED
            // intent survives even process death or a second database outage.
            $code = $error instanceof HttpExceptionInterface && $error->getStatusCode() === 403 ? 'authorization_revoked' : (in_array($error->getMessage(), ['target_changed', 'shared_object_reference', 'storage_configuration_changed'], true)
                ? $error->getMessage() : ($stage === 'finalize' ? 'database_finalize_failed' : 'storage_unavailable'));
            Log::warning('Permanent file deletion remains pending', ['operation_id' => $operation, 'error_code' => $code]);
            try {
                DB::table(self::TABLE)->where('id', $operation)->where('state', 'pending')
                    ->update(['last_error_code' => $code, 'attempts' => DB::raw('attempts + 1')]);
            } catch (\Throwable) {
                // The intent is already durable; reconciliation finds it later.
            }

            return $this->pending();
        }
    }

    /** @return array{state:string,message:string} */
    private function pending(): array
    {
        return ['state' => 'pending', 'message' => 'Deletion is pending and may already have removed the Storage object. It is not confirmed complete. Retry Delete or contact an administrator. Closing this pane does not cancel the accepted deletion.'];
    }

    public function assertNotPending(string $kind, int $id): void
    {
        if ($this->available() && DB::table(self::TABLE)->where('kind', $kind)->where('entity_id', $id)->where('state', 'pending')->exists()) {
            abort(409, 'This file has a pending permanent deletion.');
        }
    }

    /** @return list<int> */
    public function pendingIds(int $limit): array
    {
        return array_values(DB::table(self::TABLE)->where('state', 'pending')->orderBy('attempts')->orderBy('id')->limit($limit)->pluck('id')->map(fn ($id): int => (int) $id)->all());
    }
}
