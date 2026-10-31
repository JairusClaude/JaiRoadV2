<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Read-only, recipient-scoped notification feed for the JaiROADS header.
 * Never return complete audit entries, actor IDs, old/new values or user details.
 */
final class JaiRoadsNotificationsController extends Controller
{
    public function __invoke(Request $request, VerifiedProjectAccount $accounts): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        // DD accounts never resolve through legacy UserAccount or public.audit_logs.
        // Notifications belong to the explicit recipient account ONLY, not a
        // global role-based query. An inactive or invalid bridge fails closed.
        if ($user->getAttribute('dd_user_account_id') !== null) {
            $identity = app(DataDictionaryIdentityResolver::class)->resolve($user);
            abort_unless($identity !== null, 403);
            $table = 'jairoads_next.audit_logs';
            $recipientId = (int) $identity['account_id'];
        } else {
            $account = $accounts->require($user);
            $role = strtolower((string) $account->accountType);
            abort_unless(in_array($role, ['admin', 'superadmin', 'engineer', 'viewer'], true), 403);
            $table = 'audit_logs';
            $recipientId = (int) $account->getKey();
        }
        $notifications = DB::table($table)
            ->where('recipient_user_id', $recipientId)
            ->whereNotNull('notification_message')
            ->whereRaw("BTRIM(notification_message) <> ''")
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(20)
            ->get(['id', 'notification_message', 'created_at'])
            ->map(static fn ($row): array => [
                'id' => (int) $row->id,
                'notification_message' => (string) $row->notification_message,
                'created_at' => (string) $row->created_at,
            ])
            ->all();

        return response()->json(['notifications' => $notifications]);
    }
}
