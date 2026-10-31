<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MaintenanceDocument;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Temporary, fail-closed compatibility controller.
 *
 * Existing resource routes stay registered, but no operation can read,
 * mutate or upload business data. Existing policy checks remain in place.
 * The prior full implementation is backed up by the installer.
 *
 * Blocked: the maintenance_documents table is not deployed.
 * Do not activate CRUD until the shared schema, policies, and file retention
 * rules have been agreed and implemented.
 */
class MaintenanceDocumentController extends Controller
{
    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function create(): Response
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function show(string $maintenanceDocument): Response
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function edit(string $maintenanceDocument): Response
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function update(Request $request, string $maintenanceDocument): RedirectResponse
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function destroy(string $maintenanceDocument): RedirectResponse
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    /**
     * Temporarily unavailable while the MaintenanceDocument integration is incomplete.
     * Resource route parameters intentionally remain strings, preventing
     * implicit Eloquent binding before this guard can run.
     */
    public function download(string $maintenanceDocument): StreamedResponse
    {
        Gate::authorize('viewAny', MaintenanceDocument::class);

        $this->unavailable();
    }

    private function unavailable(): never
    {
        abort(503, 'This module is temporarily unavailable pending approved schema and authorization alignment.');
    }
}
