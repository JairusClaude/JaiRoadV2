<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** One canonical event plus deduplicated deliveries in the mutation transaction. */
final class OperationAudit
{
    /**
     * Store the verified actor's name at the time of the event, never the target's name.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    private function actorIdentifier(array $actor): string
    {
        if ($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null) {
            $engineer = DB::table('jairoads_next.engineers')
                ->where('id', $actor['engineer_id'])
                ->first(['first_name', 'middle_name', 'last_name']);

            if ($engineer !== null) {
                $parts = array_map(static fn ($part): string => trim((string) $part),
                    [$engineer->first_name, $engineer->middle_name, $engineer->last_name]);
                $name = implode(' ', array_filter($parts, static fn (string $part): bool => $part !== ''));

                if ($name !== '') {
                    // Match the existing actor_identifier varchar(255) column.
                    return mb_substr($name, 0, 255);
                }
            }
        }

        $username = DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->value('username');

        return AuditActorIdentifier::format($actor['account_id'], (string) $username);
    }

    /**
     * Credential reset audit: record the event, never a credential or hash.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    public function recordAdministratorPasswordReset(array $actor, int $id, bool $operatorRoot = false): void
    {
        $login = User::where('canonical_user_account_id', $actor['account_id'])->first();
        abort_unless(DB::transactionLevel() > 0 && $actor['role'] === 'SuperAdmin'
            && $actor['account_id'] !== $id && $login instanceof User
            && app(AccountIdentityResolver::class)->resolve($login) === $actor, 403);
        $account = app(AuditValues::class)->persisted('UserAccount', $id);
        abort_unless($operatorRoot
            ? app()->runningInConsole() && ($account['account_type'] ?? null) === 'SuperAdmin'
            : in_array($account['account_type'] ?? null, ['Admin', 'Engineer', 'Viewer'], true), 403);
        $safe = json_encode(app(AuditValues::class)->safe('UserAccount', $account), JSON_THROW_ON_ERROR);
        $event = (int) DB::table('jairoads_next.audit_logs')->insertGetId([
            'user_id' => $actor['account_id'], 'actor_identifier' => $this->actorIdentifier($actor),
            'action' => 'UPDATE', 'entity_type' => 'UserAccount', 'entity_id' => $id,
            'description' => $operatorRoot ? 'Trusted operator recovered a separately reviewed SuperAdmin password. No credentials recorded.'
                : 'SuperAdmin reset account password without email recovery. No credentials recorded.',
            'old_value' => $safe, 'new_value' => $safe,
            'recipient_user_id' => null, 'notification_message' => null, 'created_at' => now(),
        ]);
        app(ActivityNotifications::class)->deliver($event, $actor, 'UPDATE', 'UserAccount', $id);
    }

    /** @param array{account_id:int,role:string,engineer_id:?int} $actor
     * @param  array<string,mixed>  $meta
     * @param  array<string,mixed>  $oldMeta
     */
    public function record(array $actor, string $action, string $entity, ?int $id, string $description, array $meta = [], array $oldMeta = []): void
    {
        $lifecycle = in_array($action, ['ACTIVATE', 'DEACTIVATE'], true);
        $reassignment = $action === 'REASSIGN';
        $retirement = $action === 'RETIRE';
        if (DB::transactionLevel() < 1
            || ! in_array($action, ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'REASSIGN', 'RETIRE'], true)
            || ($lifecycle && ! in_array($entity, ['EngineerLGU', 'UserAccount'], true))
            || ($reassignment && $entity !== 'MaintenanceRecord')
            || ($retirement && $entity !== 'Engineer')
            || (($lifecycle || $reassignment || $retirement) && ($id === null || $id < 1))) {
            throw new \LogicException('Business events require an enclosing mutation transaction and supported action.');
        }
        $login = User::where('canonical_user_account_id', $actor['account_id'])->first();
        abort_unless($login instanceof User && app(AccountIdentityResolver::class)->resolve($login) === $actor && $actor['role'] !== 'Viewer', 403);
        $values = app(AuditValues::class);
        $old = $action === 'CREATE' ? [] : $values->safe($entity, $oldMeta);
        $new = $action === 'DELETE' ? [] : $values->safe($entity, $action === 'CREATE' && $id !== null && $entity !== 'EngineerLGU'
            ? $values->persisted($entity, $id) + $meta : $meta);
        if ($action === 'UPDATE' || $lifecycle || $reassignment || $retirement) {
            if ($oldMeta === []) {
                throw new \LogicException('Change auditing requires a persisted before image.');
            }
            if ($lifecycle) {
                $afterActive = $action === 'ACTIVATE';
                if (! array_key_exists('is_active', $old)
                    || ! array_key_exists('is_active', $new)
                    || $old['is_active'] !== ($action === 'DEACTIVATE')
                    || $new['is_active'] !== $afterActive) {
                    throw new \LogicException('Lifecycle audit action does not match the before/after status.');
                }
                if ($entity === 'EngineerLGU') {
                    foreach (['engineer_id', 'lgu_id'] as $key) {
                        if (! isset($meta[$key], $oldMeta[$key])
                            || (int) $meta[$key] < 1
                            || (int) $meta[$key] !== (int) $oldMeta[$key]) {
                            throw new \LogicException('EngineerLGU lifecycle auditing requires matching assignment identifiers.');
                        }
                    }
                }
            }
            if ($retirement && (($old['engineer_status'] ?? null) !== 'Active' || ($new['engineer_status'] ?? null) !== 'Retired')) {
                throw new \LogicException('RETIRE requires an Active to Retired Engineer transition.');
            }
            if ($reassignment) {
                // NULL is a permitted manager endpoint for explicitly approved unassignment.
                if (! array_key_exists('managing_engineer_id', $old)
                    || ! array_key_exists('managing_engineer_id', $new)
                    || $old['managing_engineer_id'] === $new['managing_engineer_id']) {
                    throw new \LogicException('REASSIGN requires a changed ManagingEngineer ID.');
                }
                foreach ([$old['managing_engineer_id'], $new['managing_engineer_id']] as $managerId) {
                    if ($managerId !== null && (! is_int($managerId) || $managerId < 1)) {
                        throw new \LogicException('REASSIGN requires valid nullable ManagingEngineer IDs.');
                    }
                }
            }
            [$old, $new] = $values->changes($entity, $old, $new);
            if ($old === [] && $new === []) {
                return;
            }
            $allowedChanges = match (true) {
                $lifecycle => ['is_active'],
                $reassignment => ['managing_engineer_id', 'managing_engineer_name'],
                $retirement => ['engineer_status'],
                default => null,
            };
            if ($allowedChanges !== null && array_diff(array_unique([...array_keys($old), ...array_keys($new)]), $allowedChanges) !== []) {
                throw new \LogicException('Lifecycle audit contains unrelated changed fields.');
            }
            if ($entity === 'EngineerLGU') {
                foreach (['engineer_id', 'lgu_id'] as $key) {
                    $old[$key] = $new[$key] = (int) $meta[$key];
                }
            }
            foreach (['project_ids', 'maintenance_record_ids'] as $context) {
                if (isset($meta[$context])) {
                    $old[$context] = $new[$context] = $values->safe($entity, [$context => $meta[$context]])[$context];
                }
            }
        }
        if (($action === 'CREATE' && $new === []) || ($action === 'DELETE' && $old === [])) {
            throw new \LogicException('Business auditing requires a safe entity snapshot.');
        }
        $event = (int) DB::table('jairoads_next.audit_logs')->insertGetId([
            'user_id' => $actor['account_id'], 'actor_identifier' => $this->actorIdentifier($actor),
            'action' => $action, 'entity_type' => $entity, 'entity_id' => $id, 'description' => $description,
            'old_value' => $action === 'CREATE' ? null : json_encode($old, JSON_THROW_ON_ERROR),
            'new_value' => $action === 'DELETE' ? null : json_encode($new, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null, 'notification_message' => null, 'created_at' => now(),
        ]);
        app(ActivityNotifications::class)->deliver($event, $actor, $action, $entity, $id);
    }
}
