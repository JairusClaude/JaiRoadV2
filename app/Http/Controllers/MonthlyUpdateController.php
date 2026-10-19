<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MonthlyUpdate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Response;

/**
 * Temporary, fail-closed compatibility controller.
 *
 * Existing resource routes stay registered, but no operation can read,
 * mutate or upload business data. Existing policy checks remain in place.
 * The prior full implementation is backed up by the installer.
 *
 * Blocked: the data-dictionary maintenance record mapping is not deployed.
 * Do not activate CRUD until the shared schema, policies, and file retention
 * rules have been agreed and implemented.
 */
class MonthlyUpdateController extends Controller
{
    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function create(): Response
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function show(string $monthlyUpdate): Response
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function edit(string $monthlyUpdate): Response
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function update(Request $request, string $monthlyUpdate): RedirectResponse
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MonthlyUpdate integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function destroy(string $monthlyUpdate): RedirectResponse
    {
        Gate::authorize('viewAny', MonthlyUpdate::class);

        $this->unavailable();
    }

    private function unavailable(): never
    {
        abort(503, 'This module is temporarily unavailable pending approved schema and authorization alignment.');
    }
}
