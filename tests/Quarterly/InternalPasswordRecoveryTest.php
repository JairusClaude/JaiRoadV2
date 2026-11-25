<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class InternalPasswordRecoveryTest extends PostgresTestCase
{
    private const TABLE = 'jairoads_security.password_recovery_requests';

    protected function setUp(): void
    {
        parent::setUp();
        // Parent prepares a disposable PostgreSQL schema and opens a rollback transaction.
        $sql = file_get_contents(base_path('database/sql/internal_password_recovery.sql'));
        DB::unprepared(str_replace(["BEGIN;\nCREATE SCHEMA", "\nCOMMIT;"], ["CREATE SCHEMA", ""], $sql));
    }

    private function guest(): void
    {
        $this->app['auth']->guard()->logout();
        $this->flushSession();
        $this->app['auth']->forgetGuards();
    }

    private function payload(string $email, string $code): array
    {
        return ['identifier' => $email, 'code' => $code,
            'password' => 'Internal-Recovery!456', 'password_confirmation' => 'Internal-Recovery!456'];
    }

    public function test_internal_recovery_requires_superadmin_approval_and_consumes_the_code(): void
    {
        $root = $this->account('SuperAdmin');
        $admin = $this->account('Admin');
        $engineer = $this->account('Engineer');
        $email = $engineer->email;

        $unknown = $this->postJson('/internal-recovery/request', ['identifier' => 'missing@example.test'])->assertOk()->json();
        $this->postJson('/internal-recovery/request', ['identifier' => $email])->assertOk()->assertExactJson($unknown);
        $this->postJson('/internal-recovery/request', ['identifier' => $email])->assertOk();
        $this->postJson('/internal-recovery/request', ['identifier' => $root->email])->assertOk();
        $this->assertSame(1, DB::table(self::TABLE)->count());
        $id = DB::table(self::TABLE)->value('id');
        $url = '/dd-phase3/password-recovery/requests/'.$id.'/approve';
        $approval = ['current_password' => 'Disposable-Test!123', 'identity_verified' => true];

        $this->actingAs($admin)->getJson('/dd-phase3/password-recovery/requests')->assertForbidden();
        $this->postJson($url, $approval)->assertForbidden();
        $this->guest();
        $this->actingAs($root)->getJson('/dd-phase3/password-recovery/requests')->assertOk()
            ->assertJsonPath('requests.0.email', $email);
        $this->postJson($url, ['current_password' => 'incorrect', 'identity_verified' => true])->assertUnprocessable();
        $code = $this->postJson($url, $approval)->assertOk()->json('code');
        $this->assertMatchesRegularExpression('/^[0-9]{6}$/', $code);
        $this->assertNotSame($code, DB::table(self::TABLE)->value('code_digest'));
        $this->postJson($url, $approval)->assertConflict();
        $this->guest();

        $wrong = $code === '000000' ? '000001' : '000000';
        $this->postJson('/internal-recovery/redeem', $this->payload($email, $wrong))->assertUnprocessable();
        $this->assertEquals(1, DB::table(self::TABLE)->value('attempts'));
        $this->postJson('/internal-recovery/redeem', $this->payload($email, $code))->assertOk();
        $this->postJson('/internal-recovery/redeem', $this->payload($email, $code))->assertUnprocessable();
        $this->assertSame('consumed', DB::table(self::TABLE)->value('state'));
        $this->assertNull(DB::table(self::TABLE)->value('code_digest'));
        $this->assertTrue(Hash::check('Internal-Recovery!456', $engineer->fresh()->password));
        $this->assertSame($engineer->fresh()->password, DB::table('jairoads_next.user_accounts')
            ->where('id', $engineer->dd_user_account_id)->value('password'));
    }

    public function test_five_wrong_attempts_lock_a_code(): void
    {
        $root = $this->account('SuperAdmin');
        $engineer = $this->account('Engineer');
        $this->postJson('/internal-recovery/request', ['identifier' => $engineer->email])->assertOk();
        $id = DB::table(self::TABLE)->where('account_id', $engineer->dd_user_account_id)->value('id');
        $code = $this->actingAs($root)->postJson('/dd-phase3/password-recovery/requests/'.$id.'/approve',
            ['current_password' => 'Disposable-Test!123', 'identity_verified' => true])->assertOk()->json('code');
        $this->guest();
        $wrong = $code === '000000' ? '000001' : '000000';
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/internal-recovery/redeem', $this->payload($engineer->email, $wrong))->assertUnprocessable();
        }
        $row = DB::table(self::TABLE)->where('id', $id)->first();
        $this->assertSame('locked', $row->state);
        $this->assertNull($row->code_digest);
        $this->assertTrue(Hash::check('Disposable-Test!123', $engineer->fresh()->password));
    }
}
