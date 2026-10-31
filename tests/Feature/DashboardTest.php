<?php

use App\Models\User;
use App\Models\UserAccount;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('an authenticated login without an approved account receives no dashboard access', function () {
    $this->actingAs(User::factory()->create())->get(route('dashboard'))->assertForbidden();
});

test('a verified active viewer is routed to and can read their role dashboard', function () {
    $user = User::factory()->create();
    if (DB::getDriverName() === 'pgsql') {
        // The guarded Feature configuration supplies canonical tables, without migrations.
        $id = DB::table('jairoads_next.user_accounts')->insertGetId([
            'username' => 'dashboard-viewer', 'email' => $user->email,
            'password' => $user->password, 'account_type' => 'Viewer', 'is_active' => true,
        ]);
        $user->forceFill(['dd_user_account_id' => $id])->save();
        $target = route('jairoads.dd-phase3.show', ['section' => 'dashboard']);
        $component = 'dd-phase3/RoleDashboard';
    } else {
        // Preserve the repository's isolated legacy SQLite test contract, too.
        $account = UserAccount::factory()->create(['accountType' => 'viewer', 'is_active' => true]);
        $user->forceFill(['user_account_id' => $account->id])->save();
        $target = route('jairoads.role-dashboard');
        $component = 'RoleDashboard/Index';
    }
    $this->actingAs($user)->get(route('dashboard'))->assertRedirect($target);
    $this->get($target)->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component($component));
});
