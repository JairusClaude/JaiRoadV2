<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Support\Facades\DB;

/** Existing operation audit format, shared with durable file reconciliation. */
final class DdOperationAudit
{
    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  array<string,mixed>  $meta
     * @param  array<string,mixed>  $oldMeta
     */
    public function record(array $actor, string $action, string $entity, ?int $id, string $description, array $meta = [], array $oldMeta = [], bool $notify = true): void
    {
        // Only safe identifiers/statuses; no credentials, email, geometry or private paths.
        DB::table('jairoads_next.audit_logs')->insert([
            'user_id' => $actor['account_id'],
            'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'],
            'action' => $action, 'entity_type' => $entity, 'entity_id' => $id,
            'description' => $description,
            'old_value' => $oldMeta === [] ? null : json_encode($oldMeta, JSON_THROW_ON_ERROR),
            'new_value' => $meta === [] ? null : json_encode($meta, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null, 'notification_message' => null,
            'created_at' => now(),
        ]);
        if ($notify) {
            app(DdActivityNotifications::class)
                ->record($actor, $action, $entity, $id, $description);
        }
    }
}
