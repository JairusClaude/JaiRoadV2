<?php

use App\Models\AuditLog;
use App\Models\UserAccount;

test('persisted AuditLog models reject updates, quiet saves, and deletion', function () {
    $actor = UserAccount::factory()->create(['is_active' => true]);
    $entry = AuditLog::query()->create([
        'user_id' => $actor->getKey(), 'actor_identifier' => 'Historical actor',
        'action' => 'CREATE', 'entity_type' => 'MaintenanceProject', 'entity_id' => 1,
        'description' => 'Test event', 'notification_message' => '',
    ]);
    $entry->description = 'Altered';
    expect(fn () => $entry->save())->toThrow(LogicException::class);
    expect(fn () => $entry->saveQuietly())->toThrow(LogicException::class);
    expect(fn () => $entry->delete())->toThrow(LogicException::class);
    expect($entry->fresh()->description)->toBe('Test event');
    expect($entry->fresh()->actor_identifier)->toBe('Historical actor');
});
