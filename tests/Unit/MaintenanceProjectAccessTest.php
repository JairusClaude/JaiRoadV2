<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

// Intentionally outside Feature: tests/Pest.php applies RefreshDatabase there.
// These checks must not execute migrations or open any database connection.
uses(TestCase::class);

beforeEach(function (): void {
    config([
        'app.key' => 'base64:'.base64_encode(str_repeat('x', 32)),
        'database.default' => 'forbidden',
        'database.connections.forbidden' => ['driver' => 'forbidden'],
        'session.driver' => 'array',
        'cache.default' => 'array',
    ]);
    $this->app['db']->extend('forbidden', function () {
        throw new RuntimeException('Database access is forbidden in these tests.');
    });
    $user = new User(['name' => 'Unlinked login', 'email' => 'unlinked@example.test']);
    $user->id = 42;
    $this->actingAs($user);
});

it('renders the directory status without exposing data or opening a database', function (): void {
    $this->get('/maintenance-projects')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceProjects/Index')
            ->where('integration.ready', false)
            ->where('projects.data', [])
            ->where('canCreate', false)
        );
});

it('renders Add Project with no protected coverage choices for an unlinked account', function (): void {
    $this->get('/maintenance-projects/create')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceProjects/Create')
            ->where('integration.ready', false)
            ->where('coverages', [])
        );
});

it('rejects an unlinked login even if a matching creator ID is submitted', function (): void {
    $this->post('/maintenance-projects', [
        'project_title' => 'Attempted project',
        'road_coverage_id' => 1,
        'description' => null,
        'created_by' => 42,
    ])->assertForbidden();
});
