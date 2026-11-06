<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/** Linked immutable deliveries, never event copies or read/dismiss state. */
final class DdActivityNotifications
{
    public const TABLE = 'jairoads_next.audit_notification_recipients';

    /** @return list<string> */
    public static function recipientsFor(string $actorRole): array
    {
        return in_array($actorRole, ['Admin', 'SuperAdmin', 'Engineer'], true) ? ['Admin', 'SuperAdmin'] : [];
    }

    public function available(): bool
    {
        return DB::selectOne('SELECT to_regclass(?) IS NOT NULL AS available', [self::TABLE])->available === true;
    }

    /** @param array{account_id:int,role:string,engineer_id:?int} $actor */
    public function deliver(int $eventId, array $actor, string $action, string $entity, ?int $id): void
    {
        abort_unless(DB::transactionLevel() > 0 && $this->available(), 503, 'Business auditing requires schema-owner notification setup.');
        $verb = match ($action) {
            'CREATE' => 'created', 'UPDATE' => 'updated', 'DELETE' => 'deleted', default => throw new \InvalidArgumentException('Unsupported business action.')
        };
        $message = $actor['role'].' '.$verb.' '.$entity.($id === null ? '' : ' #'.$id).'.';
        $audience = app(DataDictionaryIdentityResolver::class)->notificationRecipients($actor['role'] === 'Engineer' ? $actor['account_id'] : null)
            ->selectRaw('?::bigint AS audit_log_id, account.id AS recipient_user_id, ?::text AS notification_message, ?::timestamp AS created_at', [$eventId, $message, now()]);
        DB::table(self::TABLE)->insertUsing(['audit_log_id', 'recipient_user_id', 'notification_message', 'created_at'], $audience);
    }

    /** IDs remain canonical AuditLog IDs, not delivery sequence IDs.
     * @return list<array{id:int,notification_message:string,created_at:string}>
     */
    public function feed(int $recipient, int $limit = 20): array
    {
        $legacy = DB::table('jairoads_next.audit_logs as old')
            ->where('old.recipient_user_id', $recipient)->whereNotNull('old.notification_message')
            ->whereRaw("btrim(old.notification_message) <> ''")
            ->select(['old.id', 'old.notification_message', 'old.created_at']);
        $query = $legacy;
        if ($this->available()) {
            $legacy->whereNotExists(static fn (Builder $q) => $q->selectRaw('1')->from(self::TABLE.' as delivery')
                ->whereColumn('delivery.audit_log_id', 'old.id')->where('delivery.recipient_user_id', $recipient));
            $current = DB::table(self::TABLE)->where('recipient_user_id', $recipient)
                ->select(['audit_log_id as id', 'notification_message', 'created_at']);
            $query = $current->unionAll($legacy);
        }

        return array_values(DB::query()->fromSub($query, 'notifications')->orderByDesc('created_at')->orderByDesc('id')
            ->limit(min(20, max(1, $limit)))->get()->map(static fn ($r): array => [
                'id' => (int) $r->id, 'notification_message' => (string) $r->notification_message,
                'created_at' => (string) $r->created_at,
            ])->all());
    }
}
