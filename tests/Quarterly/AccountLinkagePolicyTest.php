<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

final class AccountLinkagePolicyTest extends PostgresTestCase
{
    public static function linkedTypes(): iterable
    {
        foreach (['Admin', 'SuperAdmin'] as $actor) {
            foreach (['Admin', 'Engineer', 'Viewer'] as $type) {
                yield $actor.' provisions '.$type => [$actor, $type];
            }
        }
    }

    #[DataProvider('linkedTypes')]
    public function test_new_admin_and_engineer_accounts_require_explicit_active_unused_links(string $actor, string $type): void
    {
        $this->actingAs($this->account($actor));
        $data = $this->input($type);
        $this->postJson('/workspace/accounts', $data)->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        $this->assertSame($actor === 'Admin' ? 2 : 1, DB::table('public.users')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $engineer = $this->engineer();
        $this->postJson('/workspace/accounts', $data + ['engineer_id' => $engineer])->assertRedirect();
        $account = DB::table('jairoads_next.user_accounts')->where('username', 'linked-new')->first();
        $login = DB::table('public.users')->where('canonical_user_account_id', $account->id)->first();
        $this->assertSame($type, $account->account_type);
        $this->assertSame($engineer, (int) $account->engineer_id);
        $this->assertTrue(hash_equals($account->password, $login->password));
        $this->assertTrue(Hash::check('Linked-Disposable!123', $login->password));
        $this->assertDatabaseHas('jairoads_next.audit_logs', ['entity_type' => 'UserAccount', 'entity_id' => $account->id, 'action' => 'CREATE']);
    }

    public static function badProfiles(): iterable
    {
        foreach (['missing', 'retired', 'linked_active', 'linked_inactive'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('badProfiles')]
    public function test_invalid_or_already_linked_profiles_never_provision_an_identity(string $case): void
    {
        $this->actingAs($this->account());
        $engineer = $this->engineer($case === 'retired' ? 'Retired' : 'Active');
        if (str_starts_with($case, 'linked_')) {
            $this->account('Engineer', $engineer, $case !== 'linked_inactive');
        }
        $before = DB::table('public.users')->count();
        foreach (['Admin', 'Engineer', 'Viewer'] as $type) {
            $this->postJson('/workspace/accounts', $this->input($type) + ['engineer_id' => $case === 'missing' ? 999999 : $engineer])
                ->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        }
        $this->assertSame($before, DB::table('public.users')->count());
        $this->assertSame($before, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_viewer_requires_a_profile_and_ordinary_creation_cannot_escalate_to_superadmin(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $this->postJson('/workspace/accounts', $this->input('Viewer'))->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        $this->postJson('/workspace/accounts', $this->input('SuperAdmin'))->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $engineer = $this->engineer();
        $this->postJson('/workspace/accounts', $this->input('Viewer') + ['engineer_id' => $engineer])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['username' => 'linked-new', 'account_type' => 'Viewer', 'engineer_id' => $engineer]);
    }

    public function test_available_profiles_are_filtered_against_all_accounts_not_the_limited_directory(): void
    {
        $admin = $this->account();
        $hash = $admin->password;
        $rows = [];
        for ($i = 0; $i < 201; $i++) {
            $rows[] = ['username' => 'filler-'.$i, 'email' => 'filler-'.$i.'@example.test', 'password' => $hash, 'account_type' => 'Viewer', 'is_active' => true];
        }
        DB::table('jairoads_next.user_accounts')->insert($rows);
        $linked = $this->engineer();
        $this->account('Engineer', $linked, false);
        $this->engineer('Retired');
        $available = $this->engineer();
        $totalAccounts = (int) DB::table('jairoads_next.user_accounts')->count();
        $this->actingAs($admin)->get('/workspace/users')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 15)->where('directory.total', $totalAccounts)
            ->has('eligibleEngineers', 1)->where('eligibleEngineerTotal', 1)
            ->where('eligibleEngineers.0.id', $available));
        // Search an early account that is outside the newest 15 displayed rows.
        $this->get('/workspace/users?directory_search=filler-0')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 1)->where('accounts.0.username', 'filler-0')->where('directory.total', 1));
        $this->get('/workspace/users?directory_page=2')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 15)->where('directory.page', 2));
        $lastPage = (int) ceil($totalAccounts / 15);
        $lastCount = $totalAccounts - (($lastPage - 1) * 15);
        $this->get('/workspace/users?directory_page=9999')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', $lastCount)->where('directory.page', $lastPage)->where('directory.pages', $lastPage));
        $this->get('/workspace/users?directory_search=no-such-account&directory_page=9999')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 0)->where('directory.page', 1)->where('directory.pages', 1));
    }

    public function test_directory_search_treats_wildcards_literally_and_normalizes_input(): void
    {
        $admin = $this->account();
        $hash = $admin->password;
        DB::table('jairoads_next.user_accounts')->insert([
            ['username' => 'specific_needle', 'email' => 'specific_needle@example.test', 'password' => $hash, 'account_type' => 'Viewer', 'is_active' => true],
            ['username' => 'specificXneedle', 'email' => 'specificXneedle@example.test', 'password' => $hash, 'account_type' => 'Viewer', 'is_active' => true],
        ]);
        $this->actingAs($admin);
        $this->get('/workspace/users?'.http_build_query(['directory_search' => '  specific_needle  ']))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 1)->where('accounts.0.username', 'specific_needle')
            ->where('directory.search', 'specific_needle'));
        $this->get('/workspace/users?'.http_build_query(['directory_search' => 'specific%needle']))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 0)->where('directory.total', 0));
        $this->get('/workspace/users?'.http_build_query(['directory_search' => str_repeat('é', 151)]))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('directory.search', str_repeat('é', 150)));
        $matchingEngineer = $this->engineer();
        $otherEngineer = $this->engineer();
        DB::table('jairoads_next.engineers')->where('id', $matchingEngineer)->update(['rank' => 'Grade_Alpha']);
        DB::table('jairoads_next.engineers')->where('id', $otherEngineer)->update(['rank' => 'GradeXAlpha']);
        $this->get('/workspace/users?'.http_build_query(['directory_tab' => 'engineers', 'directory_search' => 'Grade_Alpha']))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('engineers', 1)->where('engineers.0.id', $matchingEngineer)->where('directory.total', 1));
        $this->get('/workspace/users?'.http_build_query(['directory_tab' => 'engineers', 'directory_page' => 9999]))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('directory.page', 1)->where('directory.pages', 1));
    }

    public function test_eligible_engineer_selector_is_bounded_searchable_and_manager_only(): void
    {
        $admin = $this->account();
        $bulk = [];
        for ($i = 0; $i < 62; $i++) {
            $bulk[] = [
                'first_name' => 'Bulk'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'last_name' => 'Engineer',
                'rank' => 'Engineer II',
                'engineer_status' => 'Active',
            ];
        }
        DB::table('jairoads_next.engineers')->insert($bulk);
        $target = (int) DB::table('jairoads_next.engineers')->insertGetId([
            'first_name' => 'Hidden_Unique', 'last_name' => 'Profile',
            'rank' => 'Engineer III', 'engineer_status' => 'Active',
        ]);
        DB::table('jairoads_next.engineers')->insert([
            'first_name' => 'HiddenXUnique', 'last_name' => 'Profile',
            'rank' => 'Engineer III', 'engineer_status' => 'Active',
        ]);
        $retired = $this->engineer('Retired');
        $linked = $this->engineer();
        $this->account('Engineer', $linked);
        $expected = 64;

        $this->actingAs($admin)->get('/workspace/users')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('eligibleEngineers', 50)->where('eligibleEngineerTotal', $expected)
            ->missing('eligibleEngineers.50.id'));
        $this->getJson('/workspace/eligible-engineers')->assertOk()
            ->assertJsonCount(50, 'engineers')->assertJsonPath('total', $expected);
        $this->getJson('/workspace/eligible-engineers?'.http_build_query(['search' => ' Hidden_Unique ']))
            ->assertOk()->assertJsonCount(1, 'engineers')->assertJsonPath('total', 1)
            ->assertJsonPath('engineers.0.id', $target);
        $this->getJson('/workspace/eligible-engineers?'.http_build_query(['search' => 'Hidden%Unique']))
            ->assertOk()->assertJsonCount(0, 'engineers')->assertJsonPath('total', 0);
        $this->getJson('/workspace/eligible-engineers?'.http_build_query(['search' => (string) $retired]))
            ->assertOk()->assertJsonMissing(['id' => $retired]);
        $this->getJson('/workspace/eligible-engineers?'.http_build_query(['search' => (string) $linked]))
            ->assertOk()->assertJsonMissing(['id' => $linked]);

        $engineerLogin = $this->account('Engineer');
        // The canonical eligibility middleware rejects this JSON request before the administrator guard.
        $this->actingAs($engineerLogin)->getJson('/workspace/eligible-engineers')->assertUnauthorized();
        $this->actingAs($admin)->getJson('/workspace/eligible-engineers')->assertOk();
    }

    public function test_dashboard_and_users_do_not_load_unneeded_lgu_rows(): void
    {
        $admin = $this->account();
        DB::table('jairoads_next.lgus')->insert([
            'municipality_name' => 'Directory only municipality',
            'province' => 'Example Province', 'region' => 'Example Region',
            'mayor_first_name' => 'Example', 'mayor_last_name' => 'Mayor',
        ]);
        $expected = (int) DB::table('jairoads_next.lgus')->count();

        $this->actingAs($admin)->get('/workspace/dashboard')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('lgus', 0)->where('counts.lgus', $expected));
        $this->get('/workspace/users')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('lgus', 0)->where('counts.lgus', $expected));
    }

    public function test_existing_unlinked_admin_is_denied_without_mutating_or_grandfathering_it(): void
    {
        $admin = $this->account(linked: false);
        $before = DB::table('jairoads_next.user_accounts')->where('id', $admin->canonical_user_account_id)->first();
        $this->post(route('login'), ['email' => $admin->email, 'password' => 'Disposable-Test!123'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertNull(app(AccountIdentityResolver::class)->resolve($admin));
        $this->assertEquals($before, DB::table('jairoads_next.user_accounts')->where('id', $admin->canonical_user_account_id)->first());
    }

    public function test_provisioning_and_fortify_identity_roll_back_when_audit_insert_fails(): void
    {
        $this->actingAs($this->account());
        $engineer = $this->engineer();
        DB::connection()->beforeExecuting(static function (string $query): void {
            if (str_starts_with($query, 'insert into "jairoads_next"."audit_logs"')) {
                throw new \RuntimeException('Deliberate disposable account audit failure.');
            }
        });
        $this->postJson('/workspace/accounts', $this->input('Admin') + ['engineer_id' => $engineer])->assertServerError();
        $this->assertSame(2, DB::table('public.users')->count());
        $this->assertSame(2, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertDatabaseMissing('jairoads_next.user_accounts', ['engineer_id' => $engineer]);
    }

    public function test_new_linked_admin_keeps_admin_type_and_can_manage_their_own_eligible_activity(): void
    {
        $this->actingAs($this->account());
        $engineer = $this->engineer();
        $this->postJson('/workspace/accounts', $this->input('Admin') + ['engineer_id' => $engineer])->assertRedirect();
        $this->post(route('logout'))->assertRedirect();
        $this->post(route('login'), ['email' => 'linked-new@example.test', 'password' => 'Linked-Disposable!123'])->assertSessionHasNoErrors();
        $login = User::where('email', 'linked-new@example.test')->firstOrFail();
        $identity = app(AccountIdentityResolver::class)->resolve($login);
        $this->assertSame('Admin', $identity['role']);
        $this->assertSame($engineer, $identity['engineer_id']);
        $road = $this->road($engineer);
        $this->postJson('/workspace/ops/projects', ['project_title' => 'New linked Admin own work', 'road_coverage_id' => $road])->assertRedirect();
        $project = (int) DB::table('jairoads_next.maintenance_projects')->value('id');
        $this->postJson('/workspace/ops/records', $this->recordData($project, $engineer, 'Q4'))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['project_id' => $project, 'managing_engineer_id' => $engineer, 'created_by' => $identity['account_id']]);
    }

    private function input(string $type): array
    {
        return ['username' => 'linked-new', 'name' => 'Linked account', 'email' => 'linked-new@example.test',
            'account_type' => $type, 'password' => 'Linked-Disposable!123', 'password_confirmation' => 'Linked-Disposable!123'];
    }
}
