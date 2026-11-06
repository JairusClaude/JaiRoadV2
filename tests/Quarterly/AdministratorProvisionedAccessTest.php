<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\DataProvider;

final class AdministratorProvisionedAccessTest extends PostgresTestCase
{
    /** @return iterable<string,array{string}> */
    public static function roles(): iterable
    {
        foreach (['Admin', 'Engineer', 'Viewer'] as $role) {
            yield $role => [$role];
        }
    }

    public function test_public_registration_and_unknown_email_never_create_an_account(): void
    {
        $this->get('/register')->assertNotFound();
        $this->postJson('/register', ['name' => 'Untrusted', 'email' => 'unknown@example.test', 'password' => 'Disposable-Test!123'])->assertNotFound();
        $this->postJson('/login', ['email' => 'unknown@example.test', 'password' => 'Disposable-Test!123'])->assertUnprocessable();
        $this->assertGuest();
        $this->assertSame(0, DB::table('public.users')->count());
        $this->assertSame(0, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    #[DataProvider('roles')]
    public function test_administrator_provisioning_allows_null_verification_without_changing_role_scope(string $role): void
    {
        $admin = $this->account('Admin');
        $engineer = $this->engineer();
        $road = $this->road($engineer);
        $this->actingAs($admin)->postJson('/dd-phase3/accounts', [
            'name' => 'Provisioned test account',
            'username' => 'provisioned-account', 'email' => 'provisioned@example.test', 'account_type' => $role,
            'engineer_id' => $role === 'Viewer' ? null : $engineer, 'is_active' => true,
            'password' => 'Provisioned-Secure!123', 'password_confirmation' => 'Provisioned-Secure!123',
        ])->assertRedirect();
        $account = DB::table('jairoads_next.user_accounts')->where('email', 'provisioned@example.test')->first();
        $login = User::where('dd_user_account_id', $account->id)->firstOrFail();
        $this->assertNull($login->email_verified_at);
        $this->assertTrue($account->is_active);
        $this->postJson('/logout')->assertNoContent();
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Provisioned-Secure!123'])->assertOk();
        $this->assertAuthenticatedAs($login);
        $this->get('/dashboard')->assertRedirect('/dd-phase3/dashboard');
        $this->get('/dd-phase3/dashboard')->assertOk();
        $projectData = ['project_title' => 'Provisioned project', 'road_coverage_id' => $road];
        if ($role === 'Viewer') {
            foreach (['projects', 'records', 'updates', 'media', 'documents'] as $module) {
                $this->postJson('/dd-phase3/ops/'.$module, $projectData)->assertForbidden();
            }
        } else {
            $this->postJson('/dd-phase3/ops/projects', $projectData)->assertRedirect();
            $project = DB::table('jairoads_next.maintenance_projects')->first();
            $this->assertSame((int) $account->id, (int) $project->created_by);
            $this->putJson('/dd-phase3/ops/projects/'.$project->id, $projectData + ['description' => 'Authorized edit'])->assertRedirect();
            if ($role === 'Engineer') {
                $otherRoad = $this->road();
                $this->putJson('/dd-phase3/ops/projects/'.$project->id, array_replace($projectData, ['road_coverage_id' => $otherRoad]))->assertForbidden();
                $this->postJson('/dd-phase3/ops/records', $this->recordData((int) $project->id, $engineer))->assertRedirect();
                $record = DB::table('jairoads_next.maintenance_records')->first();
                $this->postJson('/dd-phase3/ops/updates', ['maintenance_id' => $record->id, 'update_month' => '2027-12', 'progress_percentage' => 25])->assertRedirect();
                $monthly = DB::table('jairoads_next.monthly_updates')->first();
                foreach ([PrivateSupabaseStorage::class, PrivateMonthlyMediaStorage::class] as $storage) {
                    $this->mock($storage, function (MockInterface $mock): void {
                        $mock->shouldReceive('configured')->andReturnTrue();
                        $mock->shouldReceive('upload')->once();
                    });
                }
                $this->post('/dd-phase3/ops/documents', ['maintenance_id' => $record->id, 'document_title' => 'Inspection',
                    'file' => UploadedFile::fake()->createWithContent('inspection.pdf', "%PDF-1.4\nDisposable\n%%EOF")])->assertRedirect();
                $this->post('/dd-phase3/ops/media', ['monthly_update_id' => $monthly->id,
                    'file' => UploadedFile::fake()->createWithContent('evidence.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='))])->assertRedirect();
                $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['maintenance_id' => $record->id, 'uploaded_by' => $account->id]);
                $this->assertDatabaseHas('jairoads_next.media', ['monthly_update_id' => $monthly->id, 'uploaded_by' => $account->id]);
            } else {
                $this->get('/dd-phase3/users')->assertOk();
            }
        }
        $this->assertNull($login->fresh()->email_verified_at);
        $this->assertSame($role, DB::table('jairoads_next.user_accounts')->where('id', $account->id)->value('account_type'));
    }
}
