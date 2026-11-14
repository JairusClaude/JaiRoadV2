<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\AccountIdentityResolver;
use App\Services\OperationAudit;
use Illuminate\Support\Facades\DB;

/** Invalid action/entity combinations fail before any append-only history writes. */
final class CanonicalAuditActionGuardsTest extends PostgresTestCase
{
    public function test_unsupported_actions_and_invalid_transitions_fail_closed(): void
    {
        $login = $this->account('SuperAdmin');
        $actor = app(AccountIdentityResolver::class)->resolve($login);
        $this->assertNotNull($actor);

        $invalid = [
            ['REASSIGN', 'UserAccount', ['managing_engineer_id' => 1], ['managing_engineer_id' => 2]],
            ['RETIRE', 'UserAccount', ['engineer_status' => 'Active'], ['engineer_status' => 'Retired']],
            ['ACTIVATE', 'Engineer', ['is_active' => false], ['is_active' => true]],
            ['RETIRE', 'Engineer', ['engineer_status' => 'Retired'], ['engineer_status' => 'Retired']],
            ['ACTIVATE', 'UserAccount', ['is_active' => true], ['is_active' => true]],
            ['DEACTIVATE', 'UserAccount', ['is_active' => false], ['is_active' => false]],
            ['REASSIGN', 'MaintenanceRecord', ['managing_engineer_id' => 1], ['managing_engineer_id' => 1]],
            ['REASSIGN', 'MaintenanceRecord', ['managing_engineer_id' => null], ['managing_engineer_id' => null]],
            // Strict Final DD: a manager is required on both sides of reassignment.
            ['REASSIGN', 'MaintenanceRecord', ['managing_engineer_id' => null], ['managing_engineer_id' => 2]],
            ['REASSIGN', 'MaintenanceRecord', ['managing_engineer_id' => 1], ['managing_engineer_id' => null]],
            ['REASSIGN', 'MaintenanceRecord', ['managing_engineer_id' => -1], ['managing_engineer_id' => 2]],
            ['REASSIGN', 'MaintenanceRecord', ['managing_engineer_id' => 1, 'description' => 'A'], ['managing_engineer_id' => 2, 'description' => 'B']],
            ['RETIRE', 'Engineer', ['engineer_status' => 'Active', 'rank' => 'A'], ['engineer_status' => 'Retired', 'rank' => 'B']],
        ];

        DB::transaction(function () use ($actor, $invalid): void {
            foreach ($invalid as [$action, $entity, $before, $after]) {
                try {
                    app(OperationAudit::class)->record($actor, $action, $entity, 1, 'Disposable invalid transition.', $after, $before);
                    $this->fail($action.' on '.$entity.' should have been rejected.');
                } catch (\LogicException) {
                    // Expected: the operation's action and its snapshots must agree.
                }
            }
            $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
            $this->assertSame(0, DB::table('jairoads_next.audit_notification_recipients')->count());
        });
    }
}
