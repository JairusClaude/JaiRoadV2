<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\DataProvider;

final class IntegrationCompatibilityTest extends PostgresTestCase
{
    public function test_dd_settings_keep_both_password_hashes_synchronized_and_preserve_identity(): void
    {
        $f = $this->fixture();
        $password = 'Integrated-Disposable!456';
        $this->putJson('/dd-phase3/ops/settings', [
            'username' => 'integration_admin', 'current_password' => 'Disposable-Test!123',
            'password' => $password, 'password_confirmation' => $password,
        ])->assertRedirect();
        $this->assertSynchronizedIdentity($f['user']->fresh(), $password);
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $f['user']->dd_user_account_id, 'username' => 'integration_admin', 'account_type' => 'Admin']);
        $this->assertStringNotContainsString($password, DB::table('jairoads_next.audit_logs')->get()->toJson());
    }

    public function test_fortify_password_reset_keeps_both_hashes_synchronized_and_new_login_works(): void
    {
        Notification::fake();
        $user = $this->account('Engineer', $this->engineer());
        $password = 'Reset-Disposable!456';
        $this->post(route('password.email'), ['email' => $user->email])->assertSessionHasNoErrors();
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user, $password): bool {
            $this->post(route('password.update'), [
                'email' => $user->email, 'token' => $notification->token,
                'password' => $password, 'password_confirmation' => $password,
            ])->assertSessionHasNoErrors()->assertRedirect(route('login'));

            return true;
        });
        $this->assertSynchronizedIdentity($user->fresh(), $password);
        $this->post(route('login'), ['email' => $user->email, 'password' => $password])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($user);
        $this->get('/dd-phase3/projects')->assertOk();
    }

    /** @return iterable<string,array{string}> */
    public static function auditFailures(): iterable
    {
        foreach (['project create', 'record create', 'record update'] as $operation) {
            yield $operation => [$operation];
        }
    }

    #[DataProvider('auditFailures')]
    public function test_audit_insert_failure_rolls_back_the_integrated_business_mutation(string $operation): void
    {
        $f = $this->fixture();
        $data = $this->recordData($f['project'], $f['engineer']);
        if ($operation === 'record update') {
            $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        }
        $road = $this->road($f['engineer']);
        $projects = DB::table('jairoads_next.maintenance_projects')->orderBy('id')->get()->toJson();
        $records = DB::table('jairoads_next.maintenance_records')->orderBy('id')->get()->toJson();
        $audits = DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson();
        $attempts = 0;
        DB::connection()->beforeExecuting(function (string $query) use (&$attempts): void {
            if (str_starts_with($query, 'insert into "jairoads_next"."audit_logs"')) {
                $attempts++;
                throw new \RuntimeException('Deliberate disposable-test audit failure.');
            }
        });
        if ($operation === 'project create') {
            $response = $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Must roll back', 'road_coverage_id' => $road]);
        } elseif ($operation === 'record create') {
            $response = $this->postJson('/dd-phase3/ops/records', $data);
        } else {
            $id = DB::table('jairoads_next.maintenance_records')->value('id');
            $response = $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, ['description' => 'Must roll back']));
        }
        $response->assertServerError();
        $this->assertSame(1, $attempts);
        $this->assertSame($projects, DB::table('jairoads_next.maintenance_projects')->orderBy('id')->get()->toJson());
        $this->assertSame($records, DB::table('jairoads_next.maintenance_records')->orderBy('id')->get()->toJson());
        $this->assertSame($audits, DB::table('jairoads_next.audit_logs')->orderBy('id')->get()->toJson());
    }

    public function test_period_edits_preserve_road_attachments_historical_events_and_canonical_actor(): void
    {
        $f = $this->fixture('Admin', true);
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = (int) DB::table('jairoads_next.maintenance_records')->value('id');
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $id, 'update_month' => '2026-01', 'progress_percentage' => 15,
            'created_by' => $f['user']->dd_user_account_id,
        ]);
        DB::table('jairoads_next.maintenance_documents')->insert([
            'maintenance_id' => $id, 'document_title' => 'Historical document', 'file_name' => 'fixture.pdf',
            'file_path' => 'private/disposable-fixture.pdf', 'uploaded_by' => $f['user']->dd_user_account_id,
        ]);
        DB::table('jairoads_next.media')->insert([
            'monthly_update_id' => $update, 'file_name' => 'fixture.png', 'file_path' => 'private/disposable-fixture.png',
            'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id,
        ]);
        $tables = ['road_coverages', 'monthly_updates', 'maintenance_documents', 'media'];
        $snapshots = [];
        foreach ($tables as $table) {
            $snapshots[$table] = DB::table('jairoads_next.'.$table)->orderBy('id')->get()->toJson();
        }
        $history = DB::table('jairoads_next.audit_logs')->orderBy('id')->get();
        $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, [
            'start_date' => '2026-02-03', 'estimated_duration_days' => 12,
            'status' => 'Completed', 'complete_date' => '2026-02-14',
        ]))->assertRedirect();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertRedirect();
        foreach ($snapshots as $table => $snapshot) {
            $this->assertSame($snapshot, DB::table('jairoads_next.'.$table)->orderBy('id')->get()->toJson());
        }
        $this->assertSame($history->toJson(), DB::table('jairoads_next.audit_logs')->whereIn('id', $history->pluck('id'))->orderBy('id')->get()->toJson());
        $events = DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->whereNull('recipient_user_id')->orderBy('id')->get();
        $this->assertSame(['CREATE', 'UPDATE', 'CREATE'], $events->pluck('action')->all());
        foreach ($events as $event) {
            $this->assertSame((int) $f['user']->dd_user_account_id, (int) $event->user_id);
            $this->assertSame('DD-UserAccount#'.$f['user']->dd_user_account_id, $event->actor_identifier);
        }
    }

    private function assertSynchronizedIdentity(User $user, string $password): void
    {
        $canonical = DB::table('jairoads_next.user_accounts')->where('id', $user->dd_user_account_id)->first();
        $this->assertTrue(Hash::check($password, $user->password));
        $this->assertTrue(hash_equals($canonical->password, $user->password));
        $this->assertSame((int) $user->dd_user_account_id, app(DataDictionaryIdentityResolver::class)->resolve($user)['account_id']);
    }
}
