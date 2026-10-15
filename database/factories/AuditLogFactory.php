<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/** @extends Factory<AuditLog> */
class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    public function definition(): array
    {
        $action = fake()->randomElement(['created', 'updated', 'deleted']);
        $entityId = fake()->numberBetween(1, 1000);

        return [
            'actor_identifier' => 'system',
            'action' => $action,
            'entity_type' => 'maintenance_projects',
            'entity_id' => $entityId,
            'description' => "Maintenance project #{$entityId} was {$action}.",
            'old_value' => $action === 'created'
                ? null
                : ['status' => 'Pending'],
            'new_value' => $action === 'deleted'
                ? null
                : ['status' => 'Ongoing'],
            'notification_message' => "Maintenance project #{$entityId} {$action}.",
            'user_id' => null,
            'recipient_user_id' => null,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $oldValue
     * @param  array<string, mixed>|null  $newValue
     */
    public function forChange(
        Model $entity,
        string $action,
        ?array $oldValue,
        ?array $newValue,
        ?UserAccount $actor = null,
        ?UserAccount $recipient = null
    ): static {
        if (
            ! in_array($action, ['created', 'updated', 'deleted'], true)
            || $entity->getKey() === null
        ) {
            throw new InvalidArgumentException(
                'Provide a saved entity and a created, updated, or deleted action.'
            );
        }

        $table = $entity->getTable();
        $id = $entity->getKey();

        return $this->state([
            'actor_identifier' => $actor === null
                ? 'system'
                : 'user_accounts:'.$actor->getKey(),
            'action' => $action,
            'entity_type' => $table,
            'entity_id' => $id,
            'description' => "{$table} #{$id} was {$action}.",
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'notification_message' => "{$table} #{$id} {$action}.",
            'user_id' => $actor?->getKey(),
            'recipient_user_id' => $recipient?->getKey(),
        ]);
    }
}
