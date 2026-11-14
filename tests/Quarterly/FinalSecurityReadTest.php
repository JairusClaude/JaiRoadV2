<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

final class FinalSecurityReadTest extends PostgresTestCase
{
    /** @return iterable<string,array{string}> */
    public static function roles(): iterable
    {
        foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
            yield $role => [$role];
        }
    }

    #[DataProvider('roles')]
    public function test_each_role_gets_only_its_safe_notifications_and_inactive_sessions_are_denied(string $role): void
    {
        $f = $this->fixture($role);
        $other = $this->account('Viewer');
        $own = null;
        foreach ([$f['user']->dd_user_account_id, $other->dd_user_account_id] as $recipient) {
            $id = (int) DB::table('jairoads_next.audit_logs')->insertGetId([
                'user_id' => $f['user']->dd_user_account_id, 'actor_identifier' => 'Retained actor snapshot',
                'action' => 'UPDATE', 'entity_type' => 'MaintenanceRecord', 'entity_id' => null,
                'description' => 'Administrative details not for notification feeds',
                'old_value' => json_encode(['private_path' => 'disposable/internal-only.pdf']),
                'new_value' => json_encode(['internal' => 'Not a notification field']),
                'recipient_user_id' => $recipient, 'notification_message' => 'Safe event for recipient '.$recipient,
                'created_at' => '2026-11-03 10:00:00']);
            if ((int) $recipient === (int) $f['user']->dd_user_account_id) {
                $own = $id;
            }
        }
        $history = DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();
        $this->getJson('/jairoads/notifications?recipient_user_id='.$other->dd_user_account_id)->assertOk()->assertExactJson([
            'notifications' => [['id' => $own, 'notification_message' => 'Safe event for recipient '.$f['user']->dd_user_account_id,
                'created_at' => '2026-11-03 10:00:00']],
        ]);
        // The canonical ops router deliberately has no audit mutation resource.
        $this->putJson('/dd-phase3/ops/audit_logs/'.$own, ['actor_identifier' => 'Tampered'])->assertNotFound();
        $this->deleteJson('/dd-phase3/ops/audit_logs/'.$own)->assertNotFound();
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $this->getJson('/jairoads/notifications')->assertForbidden();
        $this->assertSame($history, DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson());
    }
}
