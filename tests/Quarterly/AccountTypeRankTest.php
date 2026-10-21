<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdRoleAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

final class AccountTypeRankTest extends PostgresTestCase
{
    public function test_engineer_creation_requires_rank_and_accepts_no_position(): void
    {
        $admin = $this->account();
        $this->actingAs($admin);
        $input = ['first_name' => 'Rank', 'middle_name' => null, 'last_name' => 'Fixture', 'contact_no' => '09123456789'];
        $this->postJson('/dd-phase3/engineers', $input)->assertUnprocessable()->assertJsonValidationErrors('rank');
        $this->assertSame(0, DB::table('jairoads_next.engineers')->count());
        $this->postJson('/dd-phase3/engineers', $input + ['rank' => 'Engineer III'])->assertRedirect('/dd-phase3/users');
        $this->assertDatabaseHas('jairoads_next.engineers', ['first_name' => 'Rank', 'rank' => 'Engineer III', 'engineer_status' => 'Active']);
        $this->assertSame('Admin', DB::table('jairoads_next.user_accounts')->where('id', $admin->dd_user_account_id)->value('account_type'));
    }

    public static function provisionedTypes(): iterable
    {
        yield 'Admin' => ['Admin'];
        yield 'Engineer' => ['Engineer'];
        yield 'Viewer' => ['Viewer'];
    }

    #[DataProvider('provisionedTypes')]
    public function test_account_creation_uses_canonical_account_type_and_preserves_credentials_and_link(string $type): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $engineer = $type === 'Viewer' ? null : $this->engineer();
        $data = ['username' => 'typed-account', 'email' => 'typed@example.test', 'name' => 'Typed account',
            'account_type' => $type, 'engineer_id' => $engineer, 'password' => 'Typed-Disposable!123', 'password_confirmation' => 'Typed-Disposable!123'];
        $this->postJson('/dd-phase3/accounts', $data)->assertRedirect('/dd-phase3/users');
        $account = DB::table('jairoads_next.user_accounts')->where('username', 'typed-account')->first();
        $login = DB::table('public.users')->where('email', 'typed@example.test')->first();
        $this->assertSame($type, $account->account_type);
        $this->assertSame($engineer, $account->engineer_id);
        $this->assertSame($account->id, $login->dd_user_account_id);
        $this->assertTrue(hash_equals($account->password, $login->password));
        $this->assertTrue(Hash::check('Typed-Disposable!123', $account->password));
        if ($engineer !== null) {
            $this->assertSame('Engineer II', DB::table('jairoads_next.engineers')->where('id', $engineer)->value('rank'));
        }
    }

    public function test_position_or_rank_cannot_substitute_for_account_type_or_grant_superadmin(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $data = ['username' => 'invalid-type', 'email' => 'invalid-type@example.test', 'name' => 'Invalid type',
            'password' => 'Typed-Disposable!123', 'password_confirmation' => 'Typed-Disposable!123', 'position' => 'Admin', 'rank' => 'Admin'];
        $this->postJson('/dd-phase3/accounts', $data)->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $this->postJson('/dd-phase3/accounts', $data + ['account_type' => 'SuperAdmin'])->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $this->assertSame(1, DB::table('jairoads_next.user_accounts')->count());
    }

    public function test_rank_changes_do_not_change_account_type_links_passwords_or_capabilities(): void
    {
        $f = $this->fixture('Engineer');
        $resolver = app(DataDictionaryIdentityResolver::class);
        $beforeIdentity = $resolver->resolve($f['user']);
        $before = DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->first();
        $beforeCapabilities = DdRoleAccess::capabilities($beforeIdentity['role'], true, true);
        // There is no DD profile-update endpoint. Simulate an independent professional-rank
        // change only in this guarded disposable fixture; no application route is added.
        DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['rank' => 'SuperAdmin']);
        $after = DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->first();
        $afterIdentity = $resolver->resolve($f['user']->fresh());
        $this->assertSame($beforeIdentity, $afterIdentity);
        $this->assertSame($beforeCapabilities, DdRoleAccess::capabilities($afterIdentity['role'], true, true));
        $this->assertSame('Engineer', $after->account_type);
        $this->assertSame($before->engineer_id, $after->engineer_id);
        $this->assertSame($before->is_active, $after->is_active);
        $this->assertTrue(hash_equals($before->password, $after->password));
        $this->assertTrue(hash_equals($after->password, $f['user']->fresh()->password));
        $this->assertFalse($beforeCapabilities['manageAccounts']);
        $this->get('/dd-phase3/dashboard')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dd-phase3/RoleDashboard')->where('role', 'engineer')->where('engineer.rank', 'SuperAdmin'));
        $this->get('/dd-phase3/users')->assertForbidden();
    }

    public function test_user_directory_exposes_canonical_types_and_rank_without_legacy_position(): void
    {
        $admin = $this->account('Admin');
        $this->account('SuperAdmin');
        $this->account('Viewer');
        $engineer = $this->engineer();
        $this->account('Engineer', $engineer);
        $this->actingAs($admin)->get('/dd-phase3/users')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dd-phase3/Workspace')->where('accounts.0.account_type', 'Admin')
            ->where('accounts.1.account_type', 'SuperAdmin')->where('accounts.2.account_type', 'Viewer')
            ->where('accounts.3.account_type', 'Engineer')->where('accounts.3.engineer_id', $engineer)
            ->where('engineers.0.rank', 'Engineer II')->missing('engineers.0.position')
            ->missing('accounts.0.password')->missing('accounts.0.position'));
    }

    public function test_dd_navigation_redirects_legacy_directory_and_blocks_legacy_position_mutations(): void
    {
        $this->actingAs($this->account('Admin'))->get('/user-management')->assertRedirect('/dd-phase3/users');
        $this->postJson('/user-management/engineers', ['first_name' => 'Legacy', 'position' => 'Engineer'])->assertForbidden();
        $this->patchJson('/user-management/engineers/999', ['position' => 'Changed'])->assertForbidden();
        $this->get('/engineers')->assertForbidden();
        $this->postJson('/engineers', ['position' => 'Engineer'])->assertStatus(405);
        $this->assertSame(0, DB::table('jairoads_next.engineers')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }
}
