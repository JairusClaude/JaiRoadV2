<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Canonical business events only. Call after endpoint authorization, inside the
 * business transaction. No actor/recipient IDs are accepted from callers.
 * No update/delete API for history; public.audit_logs is deliberately unrelated.
 *
 * @phpstan-import-type Identity from DataDictionaryIdentityResolver
 */
final class DdAuditLog
{
    public function __construct(private DataDictionaryIdentityResolver $identities, private DdActivityNotifications $notifications) {}

    /** @return Identity */
    private function actor(): array
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Business audit requires the mutation transaction.');
        }
        $login = Auth::user();
        abort_unless($login instanceof User, 403);
        $actor = $this->identities->resolve($login);
        abort_unless($actor !== null && DdRoleAccess::canWriteOperations($actor['role']), 403);

        return $actor;
    }

    private function table(string $entity): Builder
    {
        $table = DdAuditValues::TABLES[$entity] ?? throw new \InvalidArgumentException('Unsupported audit entity.');

        return DB::table('jairoads_next.'.$table);
    }

    /** @return array<string, mixed> */
    private function persisted(string $entity, int $id): array
    {
        $row = $this->table($entity)->where('id', $id)->lockForUpdate()->first(DdAuditValues::fields($entity));
        abort_unless($row !== null, 404);

        return DdAuditValues::snapshot($entity, (array) $row);
    }

    public function created(string $entity, int $id): void
    {
        $actor = $this->actor();
        $after = $this->persisted($entity, $id);
        $recipient = $this->notifications->recipient($actor, 'CREATE', $entity, $after);
        $this->insert($actor, 'CREATE', $entity, $id, null, $after, $recipient);
    }

    /** Save only actual business changes, then read back the values the DB stored.
     * @param  array<string, mixed>  $data  Validated, authorized controller values.
     */
    public function update(string $entity, int $id, array $data): bool
    {
        $actor = $this->actor();
        $before = $this->persisted($entity, $id);
        [, $proposed] = DdAuditValues::changes($before, DdAuditValues::snapshot($entity, $data));
        if ($proposed === []) {
            return false;
        }
        // Unknown fields (including actor IDs and secrets) cannot be written here.
        $allowed = array_flip([...DdAuditValues::fields($entity), 'updated_at']);
        unset($allowed['id'], $allowed['created_by'], $allowed['uploaded_by']);
        $this->table($entity)->where('id', $id)->update(array_intersect_key($data, $allowed));
        $after = $this->persisted($entity, $id);
        [$old, $new] = DdAuditValues::changes($before, $after);
        if ($new === []) {
            return false;
        }
        $recipient = $this->notifications->recipient($actor, 'UPDATE', $entity, $after);
        $this->insert($actor, 'UPDATE', $entity, $id, $old, $new, $recipient);

        return true;
    }

    public function delete(string $entity, int $id): void
    {
        $actor = $this->actor();
        // Restrict to existing approved delete operations. No new file deletion workflow.
        abort_unless(in_array($actor['role'], ['Admin', 'SuperAdmin'], true)
            && in_array($entity, ['LGU', 'RoadCoverage', 'MaintenanceProject', 'MaintenanceRecord', 'MonthlyUpdate'], true), 403);
        $before = $this->persisted($entity, $id);
        $recipient = $this->notifications->recipient($actor, 'DELETE', $entity, $before);
        $this->table($entity)->where('id', $id)->delete();
        $this->insert($actor, 'DELETE', $entity, $id, $before, null, $recipient);
    }

    public function assignment(int $engineerId, int $lguId, bool $active): void
    {
        $actor = $this->actor();
        abort_unless(DdRoleAccess::canManageAccounts($actor['role']), 403);
        $key = ['engineer_id' => $engineerId, 'lgu_id' => $lguId];
        $query = $this->table('EngineerLGU')->where($key);
        $existing = (clone $query)->lockForUpdate()->first(DdAuditValues::fields('EngineerLGU'));
        $after = $key + ['is_active' => $active];
        $before = $existing === null ? null : DdAuditValues::snapshot('EngineerLGU', (array) $existing);
        if ($before !== null && DdAuditValues::changes($before, $after)[1] === []) {
            return;
        }
        if ($existing === null) {
            $this->table('EngineerLGU')->insert($after);
        } else {
            $query->update(['is_active' => $active]);
        }
        // Composite identity is preserved in both snapshots; no synthetic entity ID.
        $this->insert($actor, $existing === null ? 'CREATE' : ($active ? 'ACTIVATE' : 'DEACTIVATE'), 'EngineerLGU', null, $before, $after, null);
    }

    /** Keeps credential material out of snapshots, while auditing the successful change.
     * @param  \Closure(): void  $changePassword  Uses the existing transactional password updater.
     */
    public function settings(string $username, bool $passwordChanged, \Closure $changePassword): void
    {
        $actor = $this->actor();
        abort_unless(DdRoleAccess::canManageAccounts($actor['role']), 403);
        $id = $actor['account_id'];
        DB::table('public.users')->where('id', Auth::id())->lockForUpdate()->first(['id']);
        $before = $this->persisted('UserAccount', $id);
        if ($passwordChanged) {
            $changePassword();
        }
        if ($username !== $before['username']) {
            $this->table('UserAccount')->where('id', $id)->update(['username' => $username, 'updated_at' => now()]);
        }
        [$old, $new] = DdAuditValues::changes($before, $this->persisted('UserAccount', $id));
        if ($passwordChanged) {
            $old['credentials_changed'] = false;
            $new['credentials_changed'] = true;
        }
        if ($new !== []) {
            $this->insert($actor, 'UPDATE', 'UserAccount', $id, $old, $new, null);
        }
    }

    /** @param Identity $actor
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    private function insert(array $actor, string $action, string $entity, ?int $id, ?array $before, ?array $after, ?int $recipient): void
    {
        // Stable human-readable account identifier; not a live username lookup.
        DB::table('jairoads_next.audit_logs')->insert([
            'user_id' => $actor['account_id'], 'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'],
            'action' => $action, 'entity_type' => $entity, 'entity_id' => $id,
            'description' => $action.' '.$entity.($id === null ? '' : ' #'.$id).'.',
            'old_value' => $before === null ? null : json_encode($before, JSON_THROW_ON_ERROR),
            'new_value' => $after === null ? null : json_encode($after, JSON_THROW_ON_ERROR),
            'recipient_user_id' => $recipient,
            'notification_message' => $recipient === null ? null : $action.' · '.$entity.' #'.$id,
            'created_at' => now(),
        ]);
    }
}
