<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Support\Facades\DB;

/**
 * Recipient-specific AuditLog notifications; no new tables, no global feed,
 * and no read/unread state (not approved by the final Data Dictionary).
 */
final class DdActivityNotifications
{
    /**
     * @return list<string>
     */
    public static function recipientsFor(string $actorRole): array
    {
        return match ($actorRole) {
            'SuperAdmin' => [],
            'Admin' => ['SuperAdmin'],
            'Engineer', 'Viewer' => ['Admin', 'SuperAdmin'],
            default => [],
        };
    }

    /**
     * Call inside the SAME transaction as the business AuditLog insert.
     * The actor receives their own event; higher roles receive lower-role activity.
     * No other engineer/viewer gets another account's notifications.
     */
    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     */
    public function record(array $actor, string $action, string $entity, ?int $entityId, string $description): void
    {
        $role = (string) $actor['role'];
        $actorId = (int) $actor['account_id'];
        $targets = DB::table('jairoads_next.user_accounts')
            ->where('is_active', true)
            ->where(function ($q) use ($actorId, $role): void {
                $q->where('id', $actorId);
                $parents = self::recipientsFor($role);
                if ($parents !== []) {
                    $q->orWhereIn('account_type', $parents);
                }
            })->pluck('id')->map(static fn ($id): int => (int) $id)->all();
        $actorType = match ($role) {
            'SuperAdmin', 'Admin', 'Engineer', 'Viewer' => $role,
            default => 'User',
        };
        $safeAction = substr(str_replace('_', ' ', strtoupper($action)), 0, 40);
        $safeEntity = substr((string) $entity, 0, 80);
        $msg = $actorType.' · '.$safeAction.' · '.$safeEntity;
        if ($entityId !== null) {
            $msg .= ' #'.$entityId;
        }
        // Log in each recipient's own AuditLog notification row, with source
        // identity but no email, password, IP, private file path or raw payload.
        $rows = [];
        foreach ($targets as $targetId) {
            $rows[] = [
                'user_id' => $actorId,
                'actor_identifier' => 'DD-UserAccount#'.$actorId,
                'action' => $action,
                'entity_type' => $entity,
                'entity_id' => $entityId,
                'description' => 'Recipient notification: '.$description,
                'old_value' => null,
                'new_value' => null,
                'recipient_user_id' => $targetId,
                'notification_message' => $msg,
                'created_at' => now(),
            ];
        }
        foreach (array_chunk($rows, 100) as $batch) {
            DB::table('jairoads_next.audit_logs')->insert($batch);
        }
    }
}
