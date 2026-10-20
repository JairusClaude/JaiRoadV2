<?php

use App\Services\DataDictionary\DdAuditLog;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\DdOperationsTestCase;

uses(DdOperationsTestCase::class);

function auditRecipient(): void
{
    DB::table('jairoads_next.user_accounts')->insert([
        'id' => 78, 'username' => 'assigned-engineer', 'email' => 'engineer@example.test',
        'password' => Hash::make('fixture-password'), 'account_type' => 'Engineer', 'is_active' => true, 'engineer_id' => 99,
    ]);
    DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => 99, 'lgu_id' => 17, 'is_active' => true]);
}

function auditRow(): stdClass
{
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1);

    return DB::table('jairoads_next.audit_logs')->first();
}

function rejectAuditInsert(): void
{
    DB::unprepared("CREATE FUNCTION jairoads_next.reject_business_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit unavailable' USING ERRCODE = '23514'; END; $$; CREATE TRIGGER reject_business_audit BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_business_audit()");
}

it('records a single project CREATE with a persisted safe snapshot and verified actor', function () {
    $login = $this->linkedLogin('Admin');
    auditRecipient();
    $road = $this->road();
    $this->actingAs($login)->postJson('/dd-phase3/ops/projects', [
        'project_title' => 'New project', 'road_coverage_id' => $road,
        'user_id' => 78, 'recipient_user_id' => 78, 'password' => 'must-not-appear',
    ])->assertRedirect();
    $event = auditRow();
    expect($event->user_id)->toBe(77)->and($event->actor_identifier)->toBe('DD-UserAccount#77')
        ->and($event->old_value)->toBeNull()->and($event->recipient_user_id)->toBeNull()
        ->and($event->notification_message)->toBeNull();
    $new = json_decode($event->new_value, true);
    expect($new['project_title'])->toBe('New project')->and($new['created_by'])->toBe(77)
        ->and($new)->not->toHaveKey('password')->and($new)->not->toHaveKey('updated_at');
});

it('records exactly one UPDATE and ignores its repeated normalized no-op', function () {
    $login = $this->linkedLogin();
    $id = $this->record(77, 99);
    auditRecipient();
    $payload = $this->recordPayload($id);
    $this->actingAs($login)->putJson('/dd-phase3/ops/records/'.$id, $payload)->assertRedirect();
    $event = auditRow();
    expect(json_decode($event->old_value, true))->toBe(['description' => null])
        ->and(json_decode($event->new_value, true))->toBe(['description' => 'Updated report'])
        ->and($event->recipient_user_id)->toBe(78)->and($event->notification_message)->not->toBeEmpty();
    $timestamp = DB::table('jairoads_next.maintenance_records')->where('id', $id)->value('updated_at');
    $this->travel(2)->minutes();
    $this->putJson('/dd-phase3/ops/records/'.$id, [...$payload, 'maintenance_year' => '2026', 'start_date' => '2026-01-01 00:00:00'])->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1)
        ->and(DB::table('jairoads_next.maintenance_records')->where('id', $id)->value('updated_at'))->toBe($timestamp);
});

it('normalizes decimal and structured RoadCoverage values while preserving real edits', function () {
    $this->actingAs($this->linkedLogin());
    $id = $this->road();
    $payload = ['road_name' => 'Fixture road', 'lgu_id' => '17', 'kilometers' => '01.000', 'pavement_type' => 'Concrete', 'state_category' => 'Good',
        'geojson' => '{"coordinates":[[125.9,7.6],[125.91,7.61]],"type":"LineString"}'];
    $this->putJson('/dd-phase3/ops/roads/'.$id, $payload)->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
    $payload['kilometers'] = '1.25';
    $this->putJson('/dd-phase3/ops/roads/'.$id, $payload)->assertRedirect();
    expect(json_decode(auditRow()->new_value, true))->toBe(['kilometers' => '1.25']);
    $payload['geojson'] = '{"type":"LineString","coordinates":[[125.9,7.6],[125.91,7.61]],"properties":{"token":"private-geo-property"}}';
    $this->putJson('/dd-phase3/ops/roads/'.$id, $payload)->assertRedirect();
    $event = DB::table('jairoads_next.audit_logs')->orderByDesc('id')->first();
    expect(json_decode($event->new_value, true))->toHaveKey('geojson.sha256')
        ->and($event->new_value)->not->toContain('private-geo-property');
});

it('records a single DELETE with former state and recipient resolved before deletion', function () {
    $this->actingAs($this->linkedLogin());
    auditRecipient();
    $parent = $this->record(77, 99);
    $id = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $parent, 'created_by' => 77, 'update_month' => '2026-01', 'progress_percentage' => 25]);
    $this->deleteJson('/dd-phase3/ops/updates/'.$id)->assertRedirect();
    $event = auditRow();
    expect($event->action)->toBe('DELETE')->and($event->entity_id)->toBe($id)
        ->and($event->new_value)->toBeNull()->and($event->recipient_user_id)->toBe(78)
        ->and(json_decode($event->old_value, true)['progress_percentage'])->toBe('25')
        ->and(DB::table('jairoads_next.monthly_updates')->count())->toBe(0);
    $this->deleteJson('/dd-phase3/ops/updates/'.$id)->assertNotFound();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1);
});

it('keeps failed validation and restrictive foreign-key deletion out of successful history', function () {
    $this->actingAs($this->linkedLogin());
    $id = $this->record(77, 99);
    $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Invalid'])->assertUnprocessable();
    $project = DB::table('jairoads_next.maintenance_records')->where('id', $id)->value('project_id');
    $this->deleteJson('/dd-phase3/ops/projects/'.$project)->assertUnprocessable();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0)
        ->and(DB::table('jairoads_next.maintenance_projects')->where('id', $project)->exists())->toBeTrue();
});

it('rolls back update and deletion when the required event fails', function (string $operation) {
    $this->actingAs($this->linkedLogin());
    $id = $this->record(77, 99);
    rejectAuditInsert();
    if ($operation === 'update') {
        $this->putJson('/dd-phase3/ops/records/'.$id, $this->recordPayload($id))->assertServerError();
    } else {
        $this->deleteJson('/dd-phase3/ops/records/'.$id)->assertServerError();
    }
    expect(DB::table('jairoads_next.maintenance_records')->where('id', $id)->value('description'))->toBeNull()
        ->and(DB::table('jairoads_next.maintenance_records')->where('id', $id)->exists())->toBeTrue()
        ->and(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
})->with(['update', 'delete']);

it('rolls back both mutation and event after a later transaction failure', function () {
    $this->actingAs($this->linkedLogin());
    $id = $this->record(77, 99);
    expect(fn () => DB::transaction(function () use ($id) {
        app(DdAuditLog::class)->update('MaintenanceRecord', $id, ['description' => 'Not committed']);
        throw new RuntimeException('Failure after audit insert');
    }))->toThrow(RuntimeException::class);
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0)
        ->and(DB::table('jairoads_next.maintenance_records')->where('id', $id)->value('description'))->toBeNull();
});

it('records only the committed event across a real Laravel transaction retry', function () {
    $this->actingAs($this->linkedLogin());
    $id = $this->record(77, 99);
    $attempts = 0;
    DB::transaction(function () use ($id, &$attempts) {
        app(DdAuditLog::class)->update('MaintenanceRecord', $id, ['description' => 'Committed retry']);
        if (++$attempts === 1) {
            throw new PDOException('deadlock detected', 40001);
        }
    }, 2);
    expect($attempts)->toBe(2)->and(json_decode(auditRow()->new_value, true))->toBe(['description' => 'Committed retry']);
});

it('refuses audit writes outside a transaction or without a verified actor', function () {
    $login = $this->linkedLogin();
    $this->actingAs($login);
    $id = $this->record(77, 99);
    expect(fn () => app(DdAuditLog::class)->created('MaintenanceRecord', $id))->toThrow(LogicException::class);
    DB::table('jairoads_next.user_accounts')->where('id', 77)->update(['is_active' => false]);
    $this->putJson('/dd-phase3/ops/records/'.$id, $this->recordPayload($id))->assertForbidden();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
});

it('selects at most one eligible ManagingEngineer for record creation without admin fan-out', function (string $role) {
    $this->actingAs($this->linkedLogin($role));
    auditRecipient();
    DB::table('jairoads_next.user_accounts')->insert(['id' => 79, 'username' => 'other-admin', 'email' => 'admin@example.test', 'password' => 'test-only', 'account_type' => 'SuperAdmin', 'is_active' => true]);
    $project = $this->project(77);
    $this->postJson('/dd-phase3/ops/records', [
        'project_id' => $project, 'managing_engineer_id' => 99, 'maintenance_year' => 2026, 'quarter' => 'Q2',
        'start_date' => '2026-04-01', 'estimated_duration_days' => 90, 'status' => 'Ongoing',
    ])->assertRedirect();
    expect(auditRow()->recipient_user_id)->toBe(78);
})->with(['Admin', 'SuperAdmin']);

it('falls back to audit only for an ineligible or ambiguous recipient', function (string $condition) {
    $this->actingAs($this->linkedLogin());
    auditRecipient();
    $id = $this->record(77, 99);
    match ($condition) {
        'retired' => DB::table('jairoads_next.engineers')->where('id', 99)->update(['engineer_status' => 'Retired']),
        'inactive' => DB::table('jairoads_next.user_accounts')->where('id', 78)->update(['is_active' => false]),
        'wrong-role' => DB::table('jairoads_next.user_accounts')->where('id', 78)->update(['account_type' => 'Admin']),
        'wrong-link' => DB::table('jairoads_next.user_accounts')->where('id', 78)->update(['engineer_id' => null]),
        'unassigned' => DB::table('jairoads_next.engineer_lgus')->where('engineer_id', 99)->update(['is_active' => false]),
        'missing' => DB::table('jairoads_next.user_accounts')->where('id', 78)->delete(),
        'ambiguous' => DB::table('jairoads_next.user_accounts')->insert(['id' => 79, 'username' => 'duplicate', 'email' => 'dup@example.test', 'password' => 'fixture', 'account_type' => 'Engineer', 'engineer_id' => 99, 'is_active' => true]),
    };
    // MonthlyUpdate permits administrative updates even when the old manager retired.
    $this->postJson('/dd-phase3/ops/updates', ['maintenance_id' => $id, 'update_month' => '2026-01', 'progress_percentage' => 25])->assertRedirect();
    $event = auditRow();
    expect($event->recipient_user_id)->toBeNull()->and($event->notification_message)->toBeNull();
})->with(['retired', 'inactive', 'wrong-role', 'wrong-link', 'unassigned', 'missing', 'ambiguous']);

it('suppresses self-notification and Engineer activity notifications', function () {
    $this->actingAs($this->linkedLogin('Engineer'));
    $project = $this->project(77);
    $this->postJson('/dd-phase3/ops/records', ['project_id' => $project, 'managing_engineer_id' => 88,
        'maintenance_year' => 2026, 'quarter' => 'Q1', 'start_date' => '2026-01-01', 'estimated_duration_days' => 90, 'status' => 'Ongoing'])->assertRedirect();
    $event = auditRow();
    expect($event->recipient_user_id)->toBeNull()->and($event->notification_message)->toBeNull();
    $this->putJson('/dd-phase3/ops/records/'.$event->entity_id, $this->recordPayload($event->entity_id))->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(2)
        ->and(DB::table('jairoads_next.audit_logs')->whereNotNull('recipient_user_id')->count())->toBe(0);
});

it('normalizes assignment state and uses one lifecycle action instead of duplicate UPDATE', function () {
    $this->actingAs($this->linkedLogin());
    $payload = ['engineer_id' => 99, 'lgu_id' => 17, 'is_active' => true];
    $this->postJson('/dd-phase3/assignments', $payload)->assertRedirect();
    expect(auditRow()->action)->toBe('CREATE');
    $this->postJson('/dd-phase3/assignments', [...$payload, 'is_active' => '1'])->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1);
    $this->postJson('/dd-phase3/assignments', [...$payload, 'is_active' => '0'])->assertRedirect();
    $event = DB::table('jairoads_next.audit_logs')->orderByDesc('id')->first();
    expect($event->action)->toBe('DEACTIVATE')->and($event->entity_id)->toBeNull()
        ->and(json_decode($event->old_value, true)['is_active'])->toBeTrue()
        ->and(json_decode($event->new_value, true)['is_active'])->toBeFalse()
        ->and($event->recipient_user_id)->toBeNull();
});

it('does not audit unchanged settings and records password changes without credential material', function () {
    $login = $this->linkedLogin();
    $this->actingAs($login)->putJson('/dd-phase3/ops/settings', ['username' => 'linked-account', 'current_password' => 'old-password'])->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
    $this->putJson('/dd-phase3/ops/settings', ['username' => 'linked-account', 'current_password' => 'old-password',
        'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!'])->assertRedirect();
    $event = auditRow();
    expect(json_decode($event->new_value, true))->toBe(['credentials_changed' => true])
        ->and(json_encode($event))->not->toContain('New-password-42!', 'old-password', $login->password);
    $this->assertSynchronized($login, 'New-password-42!');
});

it('preserves historical entries and stable actor identity after account rename and deactivation', function () {
    $this->actingAs($this->linkedLogin());
    $id = $this->record(77, 99);
    $this->putJson('/dd-phase3/ops/records/'.$id, $this->recordPayload($id))->assertRedirect();
    $history = (array) auditRow();
    DB::table('jairoads_next.user_accounts')->where('id', 77)->update(['username' => 'renamed', 'is_active' => false]);
    expect((array) DB::table('jairoads_next.audit_logs')->first())->toBe($history);
});

it('allows full canonical history only to active administrative identities', function (string $role, int $status) {
    $this->actingAs($this->linkedLogin($role))->getJson('/dd-phase3/audit')->assertStatus($status);
})->with([['Admin', 200], ['SuperAdmin', 200], ['Engineer', 403], ['Viewer', 403]]);

it('returns only the authenticated account safe notifications in deterministic newest order', function (string $role) {
    $this->actingAs($this->linkedLogin($role));
    foreach ([[77, 'First'], [78, 'Other recipient'], [77, 'Second']] as [$recipient, $message]) {
        DB::table('jairoads_next.audit_logs')->insert(['user_id' => 77, 'actor_identifier' => 'Historical', 'recipient_user_id' => $recipient,
            'notification_message' => $message, 'old_value' => '{"private":"old"}', 'new_value' => '{"private":"new"}',
            'description' => 'Administrative only', 'created_at' => '2026-01-01 00:00:00']);
    }
    $rows = $this->getJson('/jairoads/notifications')->assertOk()->json('notifications');
    expect(array_column($rows, 'notification_message'))->toBe(['Second', 'First']);
    foreach ($rows as $row) {
        expect(array_keys($row))->toBe(['id', 'notification_message', 'created_at']);
    }
    $this->getJson('/dd-phase3/audit')->assertForbidden();
})->with(['Engineer', 'Viewer']);

it('does not expose audit writes, dismissal, read state or history clearing routes', function () {
    $this->actingAs($this->linkedLogin());
    foreach (['post', 'put', 'delete', 'patch'] as $method) {
        $this->{$method.'Json'}('/dd-phase3/audit')->assertStatus(405);
    }
    foreach (['/dd-phase3/audit/1', '/dd-phase3/audit/clear', '/jairoads/notifications/1/read', '/jairoads/notifications/1/dismiss'] as $uri) {
        $this->deleteJson($uri)->assertNotFound();
    }
});

it('successful Fortify authentication creates no canonical audit or notification events', function (string $role) {
    $this->linkedLogin($role);
    $this->post('/login', ['email' => 'linked@example.test', 'password' => 'old-password'])->assertRedirect();
    $this->assertAuthenticated();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
})->with(['SuperAdmin', 'Admin', 'Engineer', 'Viewer']);

it('captures LGU lifecycle snapshots and treats nullable values as no-ops', function () {
    $this->actingAs($this->linkedLogin());
    $payload = ['municipality_name' => 'New LGU', 'province' => 'Davao', 'region' => 'XI', 'mayor_first_name' => 'Test', 'mayor_middle_name' => '', 'mayor_last_name' => 'Mayor'];
    $this->postJson('/dd-phase3/lgus', $payload)->assertRedirect();
    $created = auditRow();
    $this->putJson('/dd-phase3/lgus/'.$created->entity_id, [...$payload, 'mayor_middle_name' => null])->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1);
    $this->putJson('/dd-phase3/lgus/'.$created->entity_id, [...$payload, 'municipality_name' => 'Renamed LGU'])->assertRedirect();
    $updated = DB::table('jairoads_next.audit_logs')->orderByDesc('id')->first();
    expect(json_decode($updated->old_value, true))->toBe(['municipality_name' => 'New LGU'])
        ->and(json_decode($updated->new_value, true))->toBe(['municipality_name' => 'Renamed LGU']);
    $this->deleteJson('/dd-phase3/lgus/'.$created->entity_id)->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(3)
        ->and(json_decode(DB::table('jairoads_next.audit_logs')->orderByDesc('id')->value('old_value'), true)['municipality_name'])->toBe('Renamed LGU');
});

it('audits account provisioning once without credentials or a notification', function () {
    $this->actingAs($this->linkedLogin());
    $this->postJson('/dd-phase3/accounts', ['username' => 'new.viewer', 'email' => 'new@example.test', 'name' => 'New viewer',
        'account_type' => 'Viewer', 'password' => 'New-password-42!', 'password_confirmation' => 'New-password-42!'])->assertRedirect();
    $event = auditRow();
    $account = DB::table('jairoads_next.user_accounts')->where('username', 'new.viewer')->first();
    expect($event->entity_id)->toBe($account->id)->and($event->recipient_user_id)->toBeNull()
        ->and(json_decode($event->new_value, true))->toEqual(['account_type' => 'Viewer', 'engineer_id' => null, 'id' => $account->id, 'is_active' => true, 'username' => 'new.viewer'])
        ->and($event->new_value)->not->toContain('New-password-42!', $account->password, 'new@example.test');
});

it('notifies only the assigned Engineer for monthly update changes and suppresses decimal no-ops', function () {
    $this->actingAs($this->linkedLogin());
    auditRecipient();
    $record = $this->record(77, 99);
    $payload = ['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 25, 'summary_of_text_reports' => 'Progress'];
    $this->postJson('/dd-phase3/ops/updates', $payload)->assertRedirect();
    $event = auditRow();
    expect($event->recipient_user_id)->toBe(78);
    $this->putJson('/dd-phase3/ops/updates/'.$event->entity_id, [...$payload, 'progress_percentage' => '25.000'])->assertRedirect();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1);
    $this->putJson('/dd-phase3/ops/updates/'.$event->entity_id, [...$payload, 'progress_percentage' => '26.25'])->assertRedirect();
    $update = DB::table('jairoads_next.audit_logs')->orderByDesc('id')->first();
    expect(json_decode($update->old_value, true))->toBe(['progress_percentage' => '25'])
        ->and(json_decode($update->new_value, true))->toBe(['progress_percentage' => '26.25'])
        ->and($update->recipient_user_id)->toBe(78);
    $this->postJson('/dd-phase3/ops/updates', $payload)->assertUnprocessable();
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(2);
});

it('keeps MaintenanceRecord deletion audit only', function () {
    $this->actingAs($this->linkedLogin());
    auditRecipient();
    $id = $this->record(77, 99);
    $this->deleteJson('/dd-phase3/ops/records/'.$id)->assertRedirect();
    expect(auditRow()->recipient_user_id)->toBeNull();
});

it('keeps uploaded document metadata and audit atomic and compensates rejected inserts', function (bool $fail) {
    $this->actingAs($this->linkedLogin());
    auditRecipient();
    $record = $this->record(77, 99);
    $path = null;
    $storage = Mockery::mock(PrivateSupabaseStorage::class);
    $storage->shouldReceive('configured')->andReturnTrue();
    $storage->shouldReceive('upload')->once()->withArgs(function ($file, $location) use (&$path) {
        $path = $location;

        return $file instanceof UploadedFile;
    });
    if ($fail) {
        rejectAuditInsert();
        $storage->shouldReceive('removeAfterFailure')->once()->withArgs(function ($location) use (&$path) {
            return $location === $path;
        });
    } else {
        $storage->shouldNotReceive('removeAfterFailure');
    }
    $this->app->instance(PrivateSupabaseStorage::class, $storage);
    $response = $this->post('/dd-phase3/ops/documents', ['maintenance_id' => $record, 'document_title' => 'Inspection',
        'file' => UploadedFile::fake()->create('private-file.pdf', 2, 'application/pdf')]);
    if ($fail) {
        $response->assertServerError();
        expect(DB::table('jairoads_next.maintenance_documents')->count())->toBe(0)
            ->and(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
    } else {
        $response->assertRedirect();
        $event = auditRow();
        expect($event->recipient_user_id)->toBe(78)->and($event->new_value)->not->toContain($path, 'private-file.pdf');
        $this->putJson('/dd-phase3/ops/documents/'.$event->entity_id, ['document_title' => 'Inspection'])->assertRedirect();
        expect(DB::table('jairoads_next.audit_logs')->count())->toBe(1);
        $this->putJson('/dd-phase3/ops/documents/'.$event->entity_id, ['document_title' => 'Revised inspection'])->assertRedirect();
        $updated = DB::table('jairoads_next.audit_logs')->orderByDesc('id')->first();
        expect(json_decode($updated->old_value, true))->toBe(['document_title' => 'Inspection'])
            ->and(json_decode($updated->new_value, true))->toBe(['document_title' => 'Revised inspection']);
    }
})->with([false, true]);

it('keeps media upload attribution private and compensates a failed audit', function (bool $fail) {
    $this->actingAs($this->linkedLogin());
    auditRecipient();
    $record = $this->record(77, 99);
    $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'created_by' => 77, 'update_month' => '2026-01', 'progress_percentage' => 25]);
    $path = null;
    $storage = Mockery::mock(PrivateMonthlyMediaStorage::class);
    $storage->shouldReceive('configured')->andReturnTrue();
    $storage->shouldReceive('upload')->once()->withArgs(function ($file, $location) use (&$path) {
        $path = $location;

        return $file instanceof UploadedFile;
    });
    if ($fail) {
        rejectAuditInsert();
        $storage->shouldReceive('removeAfterFailure')->once()->withArgs(function ($location) use (&$path) {
            return $location === $path;
        });
    } else {
        $storage->shouldNotReceive('removeAfterFailure');
    }
    $this->app->instance(PrivateMonthlyMediaStorage::class, $storage);
    $response = $this->post('/dd-phase3/ops/media', ['monthly_update_id' => $update,
        'file' => UploadedFile::fake()->create('private-file.png', 2, 'image/png')]);
    if ($fail) {
        $response->assertServerError();
        expect(DB::table('jairoads_next.media')->count())->toBe(0)->and(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
    } else {
        $response->assertRedirect();
        $event = auditRow();
        expect($event->recipient_user_id)->toBe(78)->and($event->new_value)->not->toContain($path, 'private-file.png');
        expect(json_decode($event->new_value, true)['uploaded_by'])->toBe(77);
    }
})->with([false, true]);
