<?php

declare(strict_types=1);

namespace Tests\Quarterly;

final class InternalPasswordRecoveryTest extends PostgresTestCase
{
    public function test_retired_recovery_queue_is_not_accessible_even_to_superadmin(): void
    {
        $root = $this->account('SuperAdmin');
        $this->actingAs($root)->getJson('/workspace/password-recovery/requests')->assertNotFound();
        $this->postJson('/workspace/password-recovery/requests/1/approve', [
            'current_password' => 'Disposable-Test!123',
            'identity_verified' => true,
        ])->assertNotFound();
    }
}
