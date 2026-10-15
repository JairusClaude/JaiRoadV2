<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('viewAny', AuditLog::class);

        return Inertia::render('AuditLogs/Index', [
            'model' => AuditLog::query()
                ->with(['user:id,username', 'recipientUser:id,username'])
                ->orderByDesc('id')
                ->paginate(20)
                ->withQueryString(),
        ]);
    }

    public function show(AuditLog $auditLog): Response
    {
        Gate::authorize('view', $auditLog);

        return Inertia::render('AuditLogs/Show', [
            'auditLog' => $auditLog->load([
                'user:id,username',
                'recipientUser:id,username',
            ]),
        ]);
    }
}
