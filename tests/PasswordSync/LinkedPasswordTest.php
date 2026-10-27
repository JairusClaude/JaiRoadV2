<?php

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\LinkedPasswordUpdater;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Tests\PasswordSyncTestCase;

uses(PasswordSyncTestCase::class);

function resetPayload(User $login, ?string $token = null): array
{
    return ['email' => $login->email, 'token' => $token ?? Password::broker()->createToken($login),
        'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!'];
}

it('resets both credentials through Fortify and consumes the token only on success', function (): void {
    Event::fake([PasswordReset::class]);
    $login = $this->linkedLogin();
    $payload = resetPayload($login);
    $this->post(route('password.update'), $payload)->assertSessionHasNoErrors()->assertRedirect(route('login'));
    $this->assertSynchronized($login, $payload['password']);
    expect(Password::broker()->tokenExists($login, $payload['token']))->toBeFalse();
    Event::assertDispatched(PasswordReset::class);
    $this->post(route('login.store'), ['email' => $login->email, 'password' => 'old-password'])->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('keeps each role and its correct dashboard after reset', function (string $role): void {
    $login = $this->linkedLogin($role);
    $this->post(route('password.update'), resetPayload($login))->assertSessionHasNoErrors();
    $this->post(route('login.store'), ['email' => $login->email, 'password' => 'New-password-42!'])->assertRedirect('/dashboard');
    $this->get('/dashboard')->assertRedirect($role === 'SuperAdmin' ? route('jairoads.dd-superadmin-landing') : route('jairoads.dd-phase3.show', ['section' => 'dashboard']));
    expect(app(DataDictionaryIdentityResolver::class)->resolve($login)['role'])->toBe($role);
    if ($role === 'Engineer') {
        expect(DB::table('jairoads_next.engineer_lgus')->where('engineer_id', 88)->value('is_active'))->toBeTrue();
    }
})->with(['SuperAdmin', 'Admin', 'Engineer', 'Viewer']);

it('does not change either credential for an invalid reset token', function (): void {
    $login = $this->linkedLogin();
    $before = $login->password;
    $this->post(route('password.update'), resetPayload($login, 'invalid-token'))->assertSessionHasErrors('email');
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue()
        ->and(hash_equals($before, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue();
});

it('denies missing inactive mismatched-email ambiguous and retired DD links without partial changes', function (string $problem): void {
    Event::fake([PasswordReset::class]);
    $login = $this->linkedLogin($problem === 'retired' ? 'Engineer' : 'Admin');
    $before = $login->password;
    match ($problem) {
        'missing' => DB::table('jairoads_next.user_accounts')->delete(),
        'inactive' => DB::table('jairoads_next.user_accounts')->update(['is_active' => false]),
        'email' => DB::table('jairoads_next.user_accounts')->update(['email' => 'different@example.test']),
        'ambiguous' => User::forceCreate(['name' => 'Other', 'email' => 'other@example.test', 'password' => 'unrelated-password', 'dd_user_account_id' => 77]),
        'retired' => DB::table('jairoads_next.engineers')->update(['engineer_status' => 'Retired']),
    };
    $payload = resetPayload($login);
    $this->post(route('password.update'), $payload)->assertSessionHasErrors('email');
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue();
    if ($problem !== 'missing') {
        expect(hash_equals($before, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue();
    }
    expect(Password::broker()->tokenExists($login, $payload['token']))->toBeTrue();
    Event::assertNotDispatched(PasswordReset::class);
})->with(['missing', 'inactive', 'email', 'ambiguous', 'retired']);

it('rolls back the first update when PostgreSQL rejects the second update', function (): void {
    $login = $this->linkedLogin();
    $before = $login->password;
    $remember = $login->remember_token;
    DB::unprepared(<<<'SQL'
        CREATE FUNCTION jairoads_next.reject_password() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Simulated second update failure' USING ERRCODE = '23514'; END; $$;
        CREATE TRIGGER reject_password BEFORE UPDATE OF password ON jairoads_next.user_accounts
        FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_password();
        SQL);
    $this->post(route('password.update'), resetPayload($login))->assertSessionHasErrors('email');
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue()
        ->and(hash_equals($before, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue()
        ->and(hash_equals($remember, $login->fresh()->remember_token))->toBeTrue();
});

it('recovers a desynchronized account only through legitimate token-verified reset', function (): void {
    $login = $this->linkedLogin(mismatch: true);
    expect(app(DataDictionaryIdentityResolver::class)->resolve($login))->toBeNull();
    expect(fn () => app(LinkedPasswordUpdater::class)->change($login, 'old-password', 'New-password-42!'))->toThrow(ValidationException::class);
    $this->post(route('password.update'), resetPayload($login))->assertSessionHasNoErrors();
    $this->assertSynchronized($login, 'New-password-42!');
    expect(app(DataDictionaryIdentityResolver::class)->resolve($login)['account_id'])->toBe(77);
});

it('preserves legacy reset behavior without matching a DD identity by email or number', function (): void {
    $linked = $this->linkedLogin();
    $ddBefore = DB::table('jairoads_next.user_accounts')->value('password');
    DB::table('public.users')->where('id', $linked->id)->delete();
    $legacy = User::forceCreate(['id' => 77, 'name' => 'Legacy', 'email' => 'linked@example.test', 'password' => 'old-password', 'user_account_id' => 77, 'dd_user_account_id' => null]);
    $this->post(route('password.update'), resetPayload($legacy))->assertSessionHasNoErrors();
    expect(Hash::check('New-password-42!', $legacy->fresh()->password))->toBeTrue()
        ->and(hash_equals($ddBefore, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue();
});

it('uses the same updater for DD Settings and excludes credentials from its audit rows', function (): void {
    $login = $this->linkedLogin();
    $this->actingAs($login)->put('/dd-phase3/ops/settings', ['username' => 'changed-name',
        'current_password' => 'old-password', 'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!',
        'account_type' => 'SuperAdmin', 'is_active' => false, 'engineer_id' => 999, 'dd_user_account_id' => 999,
    ])->assertSessionHasNoErrors()->assertRedirect(route('jairoads.dd-phase3.show', ['section' => 'settings']));
    $this->assertSynchronized($login, 'New-password-42!');
    expect(DB::table('jairoads_next.user_accounts')->value('username'))->toBe('changed-name');
    expect(DB::table('jairoads_next.user_accounts')->value('account_type'))->toBe('Admin')
        ->and(DB::table('jairoads_next.user_accounts')->value('is_active'))->toBeTrue()
        ->and($login->getAttribute('dd_user_account_id'))->toBe(77);
    $audits = json_encode(DB::table('jairoads_next.audit_logs')->get());
    expect(str_contains($audits, 'New-password-42!'))->toBeFalse()->and(str_contains($audits, $login->password))->toBeFalse();
});

it('preserves Viewer and Engineer read-only account settings restrictions', function (string $role): void {
    $login = $this->linkedLogin($role);
    $before = $login->password;
    $this->actingAs($login)->put('/dd-phase3/ops/settings', ['username' => 'changed-name', 'current_password' => 'old-password',
        'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!', 'account_type' => 'SuperAdmin', 'is_active' => true,
    ])->assertForbidden();
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue()
        ->and(DB::table('jairoads_next.user_accounts')->value('account_type'))->toBe($role);
})->with(['Viewer', 'Engineer']);

it('denies protected operations immediately when an existing session account is deactivated', function (): void {
    $login = $this->linkedLogin();
    $this->actingAs($login)->get('/dashboard')->assertRedirect();
    DB::table('jairoads_next.user_accounts')->update(['is_active' => false]);
    $this->get('/dashboard')->assertForbidden();
    $this->put('/dd-phase3/ops/settings', [])->assertForbidden();
});

it('synchronizes automatic login rehashing instead of disabling hash upgrades', function (): void {
    $login = $this->linkedLogin();
    $before = $login->password;
    config(['hashing.bcrypt.rounds' => 6]);
    Hash::forgetDrivers();
    Auth::forgetGuards();
    $this->post(route('login.store'), ['email' => $login->email, 'password' => 'old-password'])->assertSessionHasNoErrors()->assertRedirect('/dashboard');
    $login->refresh();
    expect(hash_equals($before, $login->password))->toBeFalse()
        ->and(hash_equals($login->password, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue()
        ->and(Hash::needsRehash($login->password))->toBeFalse();
    $this->get('/dashboard')->assertRedirect();
});

it('keeps MFA secrets and the recovery-code login challenge after a reset', function (): void {
    $login = $this->linkedLogin();
    $login->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_recovery_codes' => encrypt(json_encode(['fixture-recovery-code'])), 'two_factor_confirmed_at' => now()])->save();
    $secret = $login->two_factor_secret;
    $this->post(route('password.update'), resetPayload($login))->assertSessionHasNoErrors();
    expect(hash_equals($secret, $login->fresh()->two_factor_secret))->toBeTrue();
    $this->post(route('login.store'), ['email' => $login->email, 'password' => 'New-password-42!'])->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
    $this->post(route('two-factor.login'), ['recovery_code' => 'fixture-recovery-code'])->assertSessionHasNoErrors()->assertRedirect('/dashboard');
    $this->assertAuthenticatedAs($login);
});

it('preserves passkey ownership and credential material across password recovery', function (): void {
    $login = $this->linkedLogin();
    DB::table('public.passkeys')->insert(['user_id' => $login->id, 'name' => 'Existing fixture', 'credential_id' => 'fixture-id', 'credential' => json_encode(['fixture' => true]), 'created_at' => now(), 'updated_at' => now()]);
    $before = DB::table('public.passkeys')->first();
    $this->post(route('password.update'), resetPayload($login))->assertSessionHasNoErrors();
    expect((array) DB::table('public.passkeys')->first())->toBe((array) $before);
    expect($login->fresh()->passkeys()->count())->toBe(1);
    $this->getJson(route('passkey.login-options'))->assertOk()->assertJsonStructure(['options']);
});

it('rejects a stale principal after an administrator changes the explicit account link', function (): void {
    $login = $this->linkedLogin();
    $before = $login->password;
    DB::table('public.users')->where('id', $login->id)->update(['dd_user_account_id' => null]);
    expect(fn () => app(LinkedPasswordUpdater::class)->change($login, 'old-password', 'New-password-42!'))->toThrow(ValidationException::class);
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue();
});

it('rejects an unsaved login object even when its attributes match an existing account', function (): void {
    $login = $this->linkedLogin();
    $before = $login->password;
    $unsaved = new User;
    $unsaved->setRawAttributes($login->getAttributes(), true);
    expect(fn () => app(LinkedPasswordUpdater::class)->reset($unsaved, 'New-password-42!'))->toThrow(ValidationException::class);
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue();
});

it('revokes database sessions and remember tokens only for the changed account', function (): void {
    $login = $this->linkedLogin();
    $before = $login->remember_token;
    DB::table('public.sessions')->insert([
        ['id' => 'this-account', 'user_id' => $login->id, 'payload' => '', 'last_activity' => time()],
        ['id' => 'another-account', 'user_id' => 999, 'payload' => '', 'last_activity' => time()],
    ]);
    config(['session.driver' => 'database', 'session.connection' => 'password_test']);
    app(LinkedPasswordUpdater::class)->reset($login, 'New-password-42!');
    expect(DB::table('public.sessions')->pluck('id')->all())->toBe(['another-account'])
        ->and(hash_equals($before, $login->fresh()->remember_token))->toBeFalse();
});

it('keeps authenticated legacy Security Settings changes working without a DD link', function (): void {
    $login = User::forceCreate(['name' => 'Legacy', 'email' => 'legacy@example.test', 'password' => 'old-password']);
    $this->actingAs($login)->from('/settings/security')->put(route('user-password.update'), [
        'current_password' => 'old-password', 'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!',
    ])->assertSessionHasNoErrors()->assertRedirect('/settings/security');
    expect(Hash::check('New-password-42!', $login->fresh()->password))->toBeTrue()
        ->and(Hash::check('old-password', $login->password))->toBeFalse()
        ->and(DB::table('jairoads_next.user_accounts')->count())->toBe(0);
});

it('rejects stale session password hashes after a reset and confirms only the new password', function (): void {
    $login = $this->linkedLogin();
    $oldHash = $login->password;
    app(LinkedPasswordUpdater::class)->reset($login, 'New-password-42!');
    $this->actingAs($login)->withSession(['password_hash_web' => $oldHash])->get('/dashboard')->assertRedirect(route('login'));
    $this->assertGuest();
    $this->actingAs($login->fresh())->post(route('password.confirm.store'), ['password' => 'New-password-42!'])->assertSessionHasNoErrors();
});

it('rolls back Settings credentials and username when its enclosing audit fails', function (): void {
    $login = $this->linkedLogin();
    $before = $login->password;
    DB::unprepared(<<<'SQL'
        CREATE FUNCTION jairoads_next.reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Simulated audit failure' USING ERRCODE = '23514'; END; $$;
        CREATE TRIGGER reject_audit BEFORE INSERT ON jairoads_next.audit_logs
        FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_audit();
        SQL);
    $this->withoutExceptionHandling();
    expect(fn () => $this->actingAs($login)->put('/dd-phase3/ops/settings', [
        'username' => 'changed-name', 'current_password' => 'old-password',
        'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!',
    ]))->toThrow(QueryException::class);
    expect(hash_equals($before, $login->password))->toBeTrue()
        ->and(hash_equals($before, $login->fresh()->password))->toBeTrue()
        ->and(hash_equals($before, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue()
        ->and(DB::table('jairoads_next.user_accounts')->value('username'))->toBe('linked-account');
});

it('rejects inactive credential login even without a password rehash', function (string $role): void {
    $login = $this->linkedLogin($role, active: false);
    $before = $login->password;
    expect(Hash::needsRehash($before))->toBeFalse();
    $this->post(route('login.store'), ['email' => $login->email, 'password' => 'old-password'])->assertSessionHasErrors('email');
    $this->assertGuest();
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
})->with(['SuperAdmin', 'Admin', 'Engineer', 'Viewer']);

it('rejects inconsistent or retired DD credentials at login without changing either hash', function (string $problem): void {
    $login = $this->linkedLogin($problem === 'retired' ? 'Engineer' : 'Admin', mismatch: $problem === 'hash');
    if ($problem === 'email') {
        DB::table('jairoads_next.user_accounts')->update(['email' => 'other@example.test']);
    } elseif ($problem === 'retired') {
        DB::table('jairoads_next.engineers')->update(['engineer_status' => 'Retired']);
    }
    $before = $login->password;
    $canonical = DB::table('jairoads_next.user_accounts')->value('password');
    $this->post(route('login.store'), ['email' => $login->email, 'password' => 'old-password'])->assertSessionHasErrors('email');
    $this->assertGuest();
    expect(hash_equals($before, $login->fresh()->password))->toBeTrue()
        ->and(hash_equals($canonical, DB::table('jairoads_next.user_accounts')->value('password')))->toBeTrue();
})->with(['email', 'retired', 'hash']);
