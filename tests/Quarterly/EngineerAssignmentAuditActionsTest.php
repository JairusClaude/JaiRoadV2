<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;

/** Real canonical HTTP mutations and persisted audit/delivery contracts. */
final class EngineerAssignmentAuditActionsTest extends PostgresTestCase
{
    public function test_assignment_create_deactivate_reactivate_and_noops_emit_exact_actions(): void
    {
        $fixture = $this->fixture('Engineer');
        $engineerId = $this->engineer();
        $lguId = (int) DB::table('jairoads_next.engineer_lgus')
            ->where('engineer_id', $fixture['engineer'])->value('lgu_id');
        $this->assertGreaterThan(0, $lguId);
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('SuperAdmin'));

        $url = '/dd-phase3/assignments';
        $payload = ['engineer_id' => $engineerId, 'lgu_id' => $lguId];
        $history = fn () => DB::table('jairoads_next.audit_logs')
            ->where('entity_type', 'EngineerLGU')->where('entity_id', $engineerId)
            ->orderBy('id')->get();
        $deliveryCount = fn () => DB::table('jairoads_next.audit_notification_recipients')->count();

        // New assignment: CREATE, even though it begins in the active state.
        $this->postJson($url, $payload + ['is_active' => true])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.engineer_lgus', $payload + ['is_active' => true]);
        $events = $history();
        $this->assertCount(1, $events);
        $this->assertSame('CREATE', $events[0]->action);
        $this->assertNull($events[0]->old_value);
        $this->assertEquals($payload + ['is_active' => true], json_decode($events[0]->new_value, true));
        $afterCreateDeliveries = $deliveryCount();
        $this->assertGreaterThan(0, DB::table('jairoads_next.audit_notification_recipients')
            ->where('audit_log_id', $events[0]->id)->count());

        // An unchanged status is a no-op: no extra event and no delivery.
        $this->postJson($url, $payload + ['is_active' => true])->assertRedirect();
        $this->assertCount(1, $history());
        $this->assertSame($afterCreateDeliveries, $deliveryCount());

        // Active to inactive: DEACTIVATE with the complete pair identity.
        $this->postJson($url, $payload + ['is_active' => false])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.engineer_lgus', $payload + ['is_active' => false]);
        $events = $history();
        $this->assertCount(2, $events);
        $this->assertSame('DEACTIVATE', $events[1]->action);
        $this->assertEquals($payload + ['is_active' => true], json_decode($events[1]->old_value, true));
        $this->assertEquals($payload + ['is_active' => false], json_decode($events[1]->new_value, true));
        $this->assertTrue(DB::table('jairoads_next.audit_notification_recipients')
            ->where('audit_log_id', $events[1]->id)
            ->where('notification_message', 'like', '%deactivated EngineerLGU%')->exists());
        $afterDeactivateDeliveries = $deliveryCount();
        $this->postJson($url, $payload + ['is_active' => false])->assertRedirect();
        $this->assertCount(2, $history());
        $this->assertSame($afterDeactivateDeliveries, $deliveryCount());

        // Inactive to active: ACTIVATE; a second identical request remains a no-op.
        $this->postJson($url, $payload + ['is_active' => true])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.engineer_lgus', $payload + ['is_active' => true]);
        $events = $history();
        $this->assertCount(3, $events);
        $this->assertSame('ACTIVATE', $events[2]->action);
        $this->assertEquals($payload + ['is_active' => false], json_decode($events[2]->old_value, true));
        $this->assertEquals($payload + ['is_active' => true], json_decode($events[2]->new_value, true));
        $this->assertTrue(DB::table('jairoads_next.audit_notification_recipients')
            ->where('audit_log_id', $events[2]->id)
            ->where('notification_message', 'like', '%activated EngineerLGU%')->exists());
        $afterActivateDeliveries = $deliveryCount();
        $this->postJson($url, $payload + ['is_active' => true])->assertRedirect();
        $this->assertCount(3, $history());
        $this->assertSame($afterActivateDeliveries, $deliveryCount());
    }
}
