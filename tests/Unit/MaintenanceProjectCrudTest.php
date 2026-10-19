<?php

use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use App\Models\User;
use App\Models\UserAccount;
use App\Services\MaintenanceProjects\ProjectMutations;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

// No RefreshDatabase, migrations, seeders or development connection. Every test
// creates a dedicated SQLite :memory: schema and destroys it on disconnect.
uses(TestCase::class);

beforeEach(function (): void {
    config([
        'app.key' => 'base64:'.base64_encode(str_repeat('t', 32)),
        'database.default' => 'maintenance_test',
        'database.connections.maintenance_test' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'foreign_key_constraints' => true,
        ],
        'session.driver' => 'array',
        'cache.default' => 'array',
    ]);

    DB::purge('maintenance_test');

    $schema = Schema::connection('maintenance_test');

    $schema->create('user_accounts', function (Blueprint $table): void {
        $table->id();
        $table->string('username');
        $table->string('accountType');
        $table->boolean('is_active');
    });

    $schema->create('lgus', function (Blueprint $table): void {
        $table->id();
        $table->string('municipality_name');
    });

    // Use lgu_id to match the RoadCoverage model and controller.
    $schema->create('road_coverages', function (Blueprint $table): void {
        $table->id();
        $table->foreignId('lgu_id')->constrained('lgus');
        $table->string('road_name');
        $table->decimal('kilometers', 10, 2);
    });

    $schema->create('maintenance_projects', function (Blueprint $table): void {
        $table->id();
        $table->string('project_title');
        $table->text('description')->nullable();
        $table->foreignId('road_coverage_id')
            ->nullable()
            ->unique()
            ->constrained('road_coverages')
            ->restrictOnDelete();
        $table->foreignId('created_by')->constrained('user_accounts');
        $table->timestamps();

        // These columns belong to the legacy project schema used by these tests.
        foreach ([
            'status',
            'start_date',
            'end_date',
            'gravelled_road_in_km',
            'lgus_id',
            'engineers_id',
        ] as $name) {
            $table->string($name)->nullable();
        }
    });

    $schema->create('maintenance_records', function (Blueprint $table): void {
        $table->id();
        $table->foreignId('maintenance_projects_id')
            ->constrained('maintenance_projects')
            ->restrictOnDelete();
        $table->integer('maintenance_year')->default(2026);
        $table->string('quarter')->default('Q1');
        $table->string('status');
    });

    $schema->create('project_documents', function (Blueprint $table): void {
        $table->id();
        $table->foreignId('maintenance_projects_id')
            ->constrained('maintenance_projects')
            ->restrictOnDelete();
    });

    DB::table('user_accounts')->insert([
        'id' => 7,
        'username' => 'test-verified-account',
        'accountType' => 'admin',
        'is_active' => true,
    ]);

    DB::table('lgus')->insert([
        ['id' => 1, 'municipality_name' => 'Test LGU One'],
        ['id' => 2, 'municipality_name' => 'Test LGU Two'],
    ]);

    foreach ([401, 402, 403, 404] as $id) {
        DB::table('road_coverages')->insert([
            'id' => $id,
            'lgu_id' => $id === 402 ? 2 : 1,
            'road_name' => 'Test coverage '.$id,
            'kilometers' => 4.2,
        ]);
    }

    $this->actor = new User([
        'name' => 'Test login',
        'email' => 'test@example.test',
    ]);
    $this->actor->id = 9001;
    $this->actingAs($this->actor);

    // A test-only, explicit verified identity mapping. Production resolve()
    // remains null; equal numerical IDs are never used for identity.
    $this->app->instance(
        VerifiedProjectAccount::class,
        new class extends VerifiedProjectAccount
        {
            public function resolve(User $user): ?UserAccount
            {
                return $user->id === 9001 ? UserAccount::find(7) : null;
            }
        }
    );
});

afterEach(function (): void {
    MaintenanceProject::flushEventListeners();
    DB::disconnect('maintenance_test');
});

function jrProject(
    int $coverage = 401,
    string $title = 'Test project'
): MaintenanceProject {
    return MaintenanceProject::create([
        'project_title' => $title,
        'road_coverage_id' => $coverage,
        'created_by' => 7,
    ]);
}

function jrPayload(int $coverage = 401): array
{
    return [
        'project_title' => '  New project  ',
        'description' => null,
        'road_coverage_id' => $coverage,
    ];
}

function jrHistory(
    MaintenanceProject $project,
    string $status = 'Completed'
): void {
    DB::table('maintenance_records')->insert([
        'maintenance_projects_id' => $project->id,
        'status' => $status,
    ]);
}

it('creates through Laravel with backend creator and timestamps without fabricated legacy fields', function (): void {
    $this->post('/maintenance-projects', jrPayload())->assertRedirect();

    $project = MaintenanceProject::sole();

    expect($project->project_title)->toBe('New project')
        ->and($project->created_by)->toBe(7)
        ->and($project->created_by)->not->toBe($this->actor->id)
        ->and($project->created_at)->not->toBeNull()
        ->and($project->status)->toBeNull()
        ->and($project->start_date)->toBeNull()
        ->and($project->lgus_id)->toBeNull();

    $this->get('/maintenance-projects')->assertInertia(
        fn (Assert $page) => $page
            ->where('projects.total', 1)
            ->where('projects.data.0.created_by', 'test-verified-account')
            ->where('projects.data.0.municipality', 'Test LGU One')
    );

    expect(session()->has('message'))->toBeFalse();
});

it('validates title and rejects client creator or timestamp overrides', function (): void {
    foreach ([
        ['project_title' => ' '],
        ['created_by' => 9001],
        ['created_at' => '2020-01-01'],
        ['updated_at' => '2020-01-01'],
    ] as $change) {
        $this->postJson(
            '/maintenance-projects',
            array_replace(jrPayload(), $change)
        )->assertUnprocessable();
    }

    expect(MaintenanceProject::count())->toBe(0);
});

it('rejects duplicate coverage in request validation and in the transaction service', function (): void {
    jrProject();

    $this->postJson('/maintenance-projects', jrPayload())
        ->assertUnprocessable()
        ->assertJsonValidationErrors('road_coverage_id');

    expect(
        fn () => app(ProjectMutations::class)->create(
            $this->actor,
            jrPayload()
        )
    )->toThrow(ValidationException::class);

    expect(MaintenanceProject::count())->toBe(1);
});

it('edits the existing project and can change coverage without maintenance history', function (): void {
    $project = jrProject();
    $created = $project->created_at->toIso8601String();

    $this->get('/maintenance-projects/'.$project->id.'/edit')
        ->assertInertia(
            fn (Assert $page) => $page
                ->component('MaintenanceProjects/Edit')
                ->where('project.id', $project->id)
        );

    $this->put('/maintenance-projects/'.$project->id, [
        'project_title' => 'Updated',
        'description' => 'Notes',
        'road_coverage_id' => 402,
    ])->assertRedirect('/maintenance-projects/'.$project->id);

    expect(MaintenanceProject::count())->toBe(1)
        ->and($project->fresh()->road_coverage_id)->toBe(402)
        ->and($project->fresh()->created_by)->toBe(7)
        ->and($project->fresh()->created_at->toIso8601String())->toBe($created);

    $this->get('/maintenance-projects/'.$project->id)->assertInertia(
        fn (Assert $page) => $page
            ->where('project.municipality', 'Test LGU Two')
            ->where('project.project_title', 'Updated')
    );
});

it('allows title and description edits with history but blocks coverage change', function (): void {
    $project = jrProject();
    jrHistory($project);

    $this->putJson(
        '/maintenance-projects/'.$project->id,
        array_replace(jrPayload(402), ['project_title' => 'Rejected'])
    )->assertUnprocessable()
        ->assertJsonValidationErrors('road_coverage_id');

    expect(
        fn () => app(ProjectMutations::class)->update(
            $this->actor,
            $project->id,
            jrPayload(402)
        )
    )->toThrow(ValidationException::class);

    $this->put(
        '/maintenance-projects/'.$project->id,
        array_replace(jrPayload(), ['project_title' => 'Allowed'])
    )->assertRedirect();

    expect($project->fresh()->project_title)->toBe('Allowed')
        ->and($project->fresh()->road_coverage_id)->toBe(401);
});

it('cannot change to another projects coverage', function (): void {
    $one = jrProject();
    jrProject(402);

    $this->putJson(
        '/maintenance-projects/'.$one->id,
        jrPayload(402)
    )->assertUnprocessable()
        ->assertJsonValidationErrors('road_coverage_id');

    expect($one->fresh()->road_coverage_id)->toBe(401);
});

it('deletes one eligible project while preserving and releasing its coverage', function (): void {
    $one = jrProject();
    $other = jrProject(402);

    $this->delete('/maintenance-projects/'.$one->id)
        ->assertRedirect('/maintenance-projects');

    expect(MaintenanceProject::find($one->id))->toBeNull()
        ->and(MaintenanceProject::find($other->id))->not->toBeNull()
        ->and(RoadCoverage::find(401))->not->toBeNull();

    $this->post('/maintenance-projects', jrPayload())->assertRedirect();

    expect(
        MaintenanceProject::where('road_coverage_id', 401)->count()
    )->toBe(1);
});

it('blocks single deletion for ongoing and completed history', function (string $status): void {
    $project = jrProject();
    jrHistory($project, $status);

    $this->deleteJson('/maintenance-projects/'.$project->id)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('project_ids');

    expect($project->fresh())->not->toBeNull()
        ->and(DB::table('maintenance_records')->count())->toBe(1);
})->with(['Ongoing', 'Completed']);

it('atomically deletes eligible bulk selections and preserves all coverages', function (): void {
    $one = jrProject();
    $two = jrProject(402);
    $keep = jrProject(403);

    $this->delete('/maintenance-projects/bulk', [
        'project_ids' => [$two->id, $one->id],
    ])->assertRedirect('/maintenance-projects');

    expect(MaintenanceProject::pluck('id')->all())->toBe([$keep->id])
        ->and(RoadCoverage::count())->toBe(4)
        ->and(session()->has('message'))->toBeFalse();
});

it('blocks an entire mixed bulk selection and identifies the protected project', function (): void {
    $one = jrProject(401, 'Eligible');
    $two = jrProject(402, 'Protected project');
    jrHistory($two);

    $response = $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$one->id, $two->id],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('project_ids');

    expect($response->json('errors.project_ids.0'))->toContain('Protected project')
        ->and(MaintenanceProject::count())->toBe(2)
        ->and(DB::table('maintenance_records')->count())->toBe(1);
});

it('rejects empty duplicate invalid and missing bulk IDs without deleting anything', function (array $ids): void {
    jrProject();

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => $ids,
    ])->assertUnprocessable();

    expect(MaintenanceProject::count())->toBe(1);
})->with([
    fn () => [],
    fn () => [1, 1],
    fn () => ['invalid'],
    fn () => [1, 9999],
]);

it('blocks deletion when a legacy document depends on the project', function (): void {
    $one = jrProject();
    $two = jrProject(402);

    DB::table('project_documents')->insert([
        'maintenance_projects_id' => $two->id,
    ]);

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$one->id, $two->id],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('project_ids');

    expect(MaintenanceProject::count())->toBe(2)
        ->and(DB::table('project_documents')->count())->toBe(1);
});

it('rechecks new history introduced after selection and before deletion', function (): void {
    $one = jrProject();
    $two = jrProject(402);

    $this->get('/maintenance-projects')->assertOk();

    jrHistory($two, 'Ongoing');

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$one->id, $two->id],
    ])->assertUnprocessable();

    expect(MaintenanceProject::count())->toBe(2);
});

it('supports database listing search sorting municipality filtering pagination and clamping', function (): void {
    for ($i = 1; $i <= 12; $i++) {
        // Use lgu_id here too, matching the test schema above.
        DB::table('road_coverages')->insert([
            'id' => 500 + $i,
            'lgu_id' => $i <= 6 ? 1 : 2,
            'road_name' => 'Road '.$i,
            'kilometers' => 1,
        ]);

        jrProject(500 + $i, 'Unique '.$i);
    }

    $this->get('/maintenance-projects?search=Unique%2012')->assertInertia(
        fn (Assert $page) => $page->where('projects.total', 1)
    );

    $this->get('/maintenance-projects?municipality=2')->assertInertia(
        fn (Assert $page) => $page->where('projects.total', 6)
    );

    $this->get('/maintenance-projects?sort=oldest')->assertInertia(
        fn (Assert $page) => $page->where('projects.data.0.id', 1)
    );

    $this->get('/maintenance-projects?page=2')->assertInertia(
        fn (Assert $page) => $page->has('projects.data', 2)
    );

    $this->get('/maintenance-projects?page=99')->assertInertia(
        fn (Assert $page) => $page
            ->where('projects.current_page', 2)
            ->has('projects.data', 2)
    );
});

it('rejects writes by viewers engineers legacy roles and inactive accounts', function (string $role, bool $active): void {
    $project = jrProject();

    DB::table('user_accounts')->where('id', 7)->update([
        'accountType' => $role,
        'is_active' => $active,
    ]);

    $this->postJson('/maintenance-projects', jrPayload(402))->assertForbidden();
    $this->putJson('/maintenance-projects/'.$project->id, jrPayload())->assertForbidden();
    $this->deleteJson('/maintenance-projects/'.$project->id)->assertForbidden();

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$project->id],
    ])->assertForbidden();

    expect(MaintenanceProject::count())->toBe(1);
})->with([
    ['viewer', true],
    ['engineer', true],
    ['user', true],
    ['admin', false],
]);

it('does not infer identity from matching IDs when the production resolver is used', function (): void {
    $this->app->instance(
        VerifiedProjectAccount::class,
        new VerifiedProjectAccount
    );

    $this->actor->id = 7;

    $this->postJson('/maintenance-projects', jrPayload())->assertForbidden();

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [1],
    ])->assertForbidden();

    expect(MaintenanceProject::count())->toBe(0);
});

it('enforces coverage uniqueness at the database constraint as a second guard', function (): void {
    jrProject();

    expect(fn () => jrProject())
        ->toThrow(UniqueConstraintViolationException::class);

    expect(MaintenanceProject::count())->toBe(1);
});

it('does not partially delete when one selected project fails authorization', function (): void {
    $one = jrProject();
    $two = jrProject(402);

    Gate::before(
        fn ($user, $ability, $arguments) => $ability === 'delete'
            && $arguments[0]->id === $two->id ? false : null
    );

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$one->id, $two->id],
    ])->assertForbidden();

    expect(MaintenanceProject::count())->toBe(2);
});

it('protects creator and timestamps during edit', function (): void {
    $project = jrProject();

    $this->putJson('/maintenance-projects/'.$project->id, [
        ...jrPayload(),
        'created_by' => 9001,
    ])->assertUnprocessable();

    expect($project->fresh()->created_by)->toBe(7);
});

it('lets a verified Engineer manage only coverages approved by the assignment adapter and never delete', function (): void {
    DB::table('user_accounts')->where('id', 7)->update([
        'accountType' => 'engineer',
    ]);

    $this->app->instance(
        VerifiedProjectAccount::class,
        new class extends VerifiedProjectAccount
        {
            public function resolve(User $user): ?UserAccount
            {
                return UserAccount::find(7);
            }

            public function assignedTo(
                UserAccount $account,
                RoadCoverage $coverage
            ): bool {
                return $coverage->id === 401;
            }
        }
    );

    $this->post('/maintenance-projects', jrPayload())->assertRedirect();

    $project = MaintenanceProject::sole();

    $this->put('/maintenance-projects/'.$project->id, jrPayload())->assertRedirect();

    $this->putJson(
        '/maintenance-projects/'.$project->id,
        jrPayload(402)
    )->assertForbidden();

    $this->deleteJson('/maintenance-projects/'.$project->id)->assertForbidden();

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$project->id],
    ])->assertForbidden();

    expect($project->fresh()->road_coverage_id)->toBe(401);
});

it('rolls back the whole batch if a dependency appears after its eligibility checks', function (): void {
    $one = jrProject();
    $two = jrProject(402);

    // Simulate a late dependency at the delete boundary. This exercises the
    // actual FK error and rollback, not a mocked transaction implementation.
    MaintenanceProject::deleting(function ($project) use ($two): void {
        if ($project->id === $two->id) {
            DB::table('maintenance_records')->insert([
                'maintenance_projects_id' => $two->id,
                'status' => 'Ongoing',
            ]);
        }
    });

    $this->deleteJson('/maintenance-projects/bulk', [
        'project_ids' => [$one->id, $two->id],
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('project_ids');

    expect(MaintenanceProject::count())->toBe(2)
        ->and(DB::table('maintenance_records')->count())->toBe(0);
});

it('returns validation errors for malformed or missing coverage IDs without changing projects', function ($coverage): void {
    $project = jrProject();

    $this->postJson('/maintenance-projects', [
        ...jrPayload(),
        'road_coverage_id' => $coverage,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('road_coverage_id');

    $this->putJson('/maintenance-projects/'.$project->id, [
        ...jrPayload(),
        'road_coverage_id' => $coverage,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('road_coverage_id');

    expect($project->fresh()->road_coverage_id)->toBe(401)
        ->and(MaintenanceProject::count())->toBe(1);
})->with([
    fn () => [],
    fn () => 'invalid',
    fn () => 0,
    fn () => 9999,
]);
