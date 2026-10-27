<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

final class AccountLinkagePolicyTest extends PostgresTestCase
{
    public static function linkedTypes(): iterable
    {
        foreach (['Admin', 'SuperAdmin'] as $actor) {
            foreach (['Admin', 'Engineer'] as $type) {
                yield $actor.' provisions '.$type => [$actor, $type];
            }
        }
    }

    #[DataProvider('linkedTypes')]
    public function test_new_admin_and_engineer_accounts_require_explicit_active_unused_links(string $actor, string $type): void
    {
        $this->actingAs($this->account($actor));
        $data = $this->input($type);
        $this->postJson('/dd-phase3/accounts', $data)->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        $this->assertSame(1, DB::table('public.users')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $engineer = $this->engineer();
        $this->postJson('/dd-phase3/accounts', $data + ['engineer_id' => $engineer])->assertRedirect();
        $account = DB::table('jairoads_next.user_accounts')->where('username', 'linked-new')->first();
        $login = DB::table('public.users')->where('dd_user_account_id', $account->id)->first();
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
        foreach (['Admin', 'Engineer'] as $type) {
            $this->postJson('/dd-phase3/accounts', $this->input($type) + ['engineer_id' => $case === 'missing' ? 999999 : $engineer])
                ->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        }
        $this->assertSame($before, DB::table('public.users')->count());
        $this->assertSame($before, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_viewer_is_unlinked_and_ordinary_creation_cannot_escalate_to_superadmin(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $this->postJson('/dd-phase3/accounts', $this->input('Viewer') + ['engineer_id' => $this->engineer()])->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        $this->postJson('/dd-phase3/accounts', $this->input('SuperAdmin'))->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $this->postJson('/dd-phase3/accounts', $this->input('Viewer'))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['username' => 'linked-new', 'account_type' => 'Viewer', 'engineer_id' => null]);
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
        $this->actingAs($admin)->get('/dd-phase3/users')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('accounts', 200)->has('eligibleEngineers', 1)->where('eligibleEngineers.0.id', $available));
    }

    public function test_existing_unlinked_admin_can_login_create_projects_and_choose_only_real_managers(): void
    {
        $engineer = $this->engineer();
        $this->account('Engineer', $engineer);
        $admin = $this->account();
        $before = DB::table('jairoads_next.user_accounts')->where('id', $admin->dd_user_account_id)->first();
        $road = $this->road($engineer);
        $this->post(route('login'), ['email' => $admin->email, 'password' => 'Disposable-Test!123'])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($admin);
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Unlinked Admin compatibility', 'road_coverage_id' => $road])->assertRedirect();
        $project = (int) DB::table('jairoads_next.maintenance_projects')->value('id');
        $this->get('/dd-phase3/projects?view=show&project='.$project)->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('managerChoices', 1)->where('managerChoices.0.id', $engineer));
        $after = DB::table('jairoads_next.user_accounts')->where('id', $admin->dd_user_account_id)->first();
        $this->assertEquals($before, $after);
        $this->assertNull(app(DataDictionaryIdentityResolver::class)->resolve($admin)['engineer_id']);
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
        $this->postJson('/dd-phase3/accounts', $this->input('Admin') + ['engineer_id' => $engineer])->assertServerError();
        $this->assertSame(1, DB::table('public.users')->count());
        $this->assertSame(1, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertDatabaseMissing('jairoads_next.user_accounts', ['engineer_id' => $engineer]);
    }

    public function test_new_linked_admin_keeps_admin_type_and_can_manage_their_own_eligible_activity(): void
    {
        $this->actingAs($this->account());
        $engineer = $this->engineer();
        $this->postJson('/dd-phase3/accounts', $this->input('Admin') + ['engineer_id' => $engineer])->assertRedirect();
        Auth::logout();
        $this->post(route('login'), ['email' => 'linked-new@example.test', 'password' => 'Linked-Disposable!123'])->assertSessionHasNoErrors();
        $login = User::where('email', 'linked-new@example.test')->firstOrFail();
        $identity = app(DataDictionaryIdentityResolver::class)->resolve($login);
        $this->assertSame('Admin', $identity['role']);
        $this->assertSame($engineer, $identity['engineer_id']);
        $road = $this->road($engineer);
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'New linked Admin own work', 'road_coverage_id' => $road])->assertRedirect();
        $project = (int) DB::table('jairoads_next.maintenance_projects')->value('id');
        $this->postJson('/dd-phase3/ops/records', $this->recordData($project, $engineer, 'Q4'))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['project_id' => $project, 'managing_engineer_id' => $engineer, 'created_by' => $identity['account_id']]);
    }

    private function input(string $type): array
    {
        return ['username' => 'linked-new', 'name' => 'Linked account', 'email' => 'linked-new@example.test',
            'account_type' => $type, 'password' => 'Linked-Disposable!123', 'password_confirmation' => 'Linked-Disposable!123'];
    }
}
