<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

final class RoleAwareAccountCreationTest extends PostgresTestCase
{
    public static function creatableRoles(): iterable
    {
        yield 'Admin' => ['Admin'];
        yield 'Engineer' => ['Engineer'];
        yield 'Viewer' => ['Viewer'];
    }

    private function payload(string $role): array
    {
        $username = 'new-'.bin2hex(random_bytes(6));

        return [
            'username' => $username,
            'email' => $username.'@example.test',
            'name' => 'New test account',
            'account_type' => $role,
            'password' => 'Disposable-Test!123',
            'password_confirmation' => 'Disposable-Test!123',
        ];
    }

    private function profile(): array
    {
        return ['first_name' => 'New', 'last_name' => 'Engineer', 'contact_no' => '09123456789', 'rank' => 'Engineer II'];
    }

    #[DataProvider('creatableRoles')]
    public function test_creation_follows_role_profile_requirements(string $role): void
    {
        $actor = $this->account('SuperAdmin');
        $before = DB::table('jairoads_next.engineers')->count();
        $payload = $this->payload($role);
        if ($role !== 'Viewer') {
            $payload['profile'] = $this->profile();
        }

        $this->actingAs($actor)->post('/workspace/accounts', $payload)
            ->assertSessionHasNoErrors()->assertRedirect();
        $row = DB::table('jairoads_next.user_accounts')->where('email', $payload['email'])->first();
        $this->assertNotNull($row);
        $this->assertSame($role, $row->account_type);
        if ($role === 'Viewer') {
            $this->assertNull($row->engineer_id);
            $this->assertEquals($before, DB::table('jairoads_next.engineers')->count());
        } else {
            $this->assertNotNull($row->engineer_id);
            $this->assertEquals($before + 1, DB::table('jairoads_next.engineers')->count());
            $this->assertSame('Active', DB::table('jairoads_next.engineers')->where('id', $row->engineer_id)->value('engineer_status'));
        }
        $login = User::where('email', $payload['email'])->firstOrFail();
        $this->assertSame($role, app(AccountIdentityResolver::class)->resolve($login)['role']);
    }

    public function test_missing_required_profile_and_unwanted_profile_links_are_rejected(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        $actor = $this->account('SuperAdmin');
        $this->actingAs($actor);
        $existing = $this->engineer();
        $before = DB::table('jairoads_next.user_accounts')->count();

        foreach (['Admin', 'Engineer'] as $role) {
            $this->postJson('/workspace/accounts', $this->payload($role))->assertUnprocessable()->assertJsonValidationErrors('profile');
            $this->postJson('/workspace/accounts', $this->payload($role) + ['engineer_id' => $existing])
                ->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        }
        $this->postJson('/workspace/accounts', $this->payload('Viewer') + ['profile' => $this->profile()])
            ->assertUnprocessable()->assertJsonValidationErrors('profile');
        $this->postJson('/workspace/accounts', $this->payload('Viewer') + ['engineer_id' => $existing])
            ->assertUnprocessable()->assertJsonValidationErrors('engineer_id');

        $this->assertEquals($before, DB::table('jairoads_next.user_accounts')->count());
    }
}
