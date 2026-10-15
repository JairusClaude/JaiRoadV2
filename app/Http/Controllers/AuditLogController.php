
<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserAccount;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AuditLogController extends Controller
{
    /**
     * Display full audit history to authorized administrators only.
     */
    public function index(): Response
    {
        Gate::authorize('viewAny', AuditLog::class);

        return Inertia::render('AuditLogs/Index', [
            'model' => AuditLog::query()
                ->with([
                    'user:id,username',
                    'recipientUser:id,username',
                ])
                ->orderByDesc('id')
                ->paginate(20)
                ->withQueryString(),
        ]);
    }

    /**
     * Display one complete audit record to authorized administrators.
     */
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

    /**
     * Display only the authenticated account's eligible notifications.
     *
     * Never return OldValue, NewValue, or the complete AuditLog model here.
     */
    public function notifications(Request $request): Response
    {
        Gate::authorize('viewNotifications', AuditLog::class);

        $account = $this->currentActiveUserAccount($request);

        $notifications = AuditLog::query()
            ->where('recipient_user_id', $account->getKey())
            ->whereNotNull('notification_message')
            ->whereRaw("TRIM(notification_message) <> ''")
            ->orderByDesc('created_at')
            ->paginate(20)
            ->through(static function (AuditLog $entry): array {
                return [
                    'id' => $entry->getKey(),
                    'notification_message' => $entry->notification_message,
                    'created_at' => $entry->created_at,
                ];
            })
            ->withQueryString();

        return Inertia::render('AuditLogs/Notifications', [
            'notifications' => $notifications,
        ]);
    }

    /**
     * Resolve the logged-in Laravel user to their active UserAccount.
     */
    private function currentActiveUserAccount(
        Request $request
    ): UserAccount {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        $account = $user->userAccount()
            ->where('is_active', true)
            ->first();

        abort_unless(
            $account instanceof UserAccount,
            403,
            'No active UserAccount is linked to your login.'
        );

        return $account;
    }
}

