<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** One canonical event plus deduplicated deliveries in the mutation transaction. */
final class OperationAudit
{
    /** @param array{account_id:int,role:string,engineer_id:?int} $actor
     * @param  array<string,mixed>  $meta
     * @param  array<string,mixed>  $oldMeta
     */
    public function record(array $actor, string $action, string $entity, ?int $id, string $description, array $meta = [], array $oldMeta = []): void
    {
        if (DB::transactionLevel() < 1 || ! in_array($action, ['CREATE', 'UPDATE', 'DELETE'], true)) {
            throw new \LogicException('Business events require an enclosing mutation transaction and supported action.');
        }
        $login = User::where('dd_user_account_id', $actor['account_id'])->first();
        abort_unless($login instanceof User && app(AccountIdentityResolver::class)->resolve($login) === $actor && $actor['role'] !== 'Viewer', 403);
        $values = app(AuditValues::class);
        $old = $action === 'CREATE' ? [] : $values->safe($entity, $oldMeta);
        $new = $action === 'DELETE' ? [] : $values->safe($entity, $action === 'CREATE' && $id !== null && $entity !== 'EngineerLGU'
            ? $values->persisted($entity, $id) + $meta : $meta);
        if ($action === 'UPDATE') {
            if ($oldMeta === []) {
                throw new \LogicException('UPDATE auditing requires a persisted before image.');
            }
            [$old, $new] = $values->changes($entity, $old, $new);
            if ($old === [] && $new === []) {
                return;
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
        $username = DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->value('username');
        $event = (int) DB::table('jairoads_next.audit_logs')->insertGetId([
            'user_id' => $actor['account_id'], 'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'].' ('.$username.')',
            'action' => $action, 'entity_type' => $entity, 'entity_id' => $id, 'description' => $description,
            'old_value' => $action === 'CREATE' ? null : json_encode($old, JSON_THROW_ON_ERROR),
            'new_value' => $action === 'DELETE' ? null : json_encode($new, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null, 'notification_message' => null, 'created_at' => now(),
        ]);
        app(ActivityNotifications::class)->deliver($event, $actor, $action, $entity, $id);
    }
}
