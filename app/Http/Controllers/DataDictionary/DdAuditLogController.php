<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdRoleAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Canonical administrative history, read-only. Legacy policies remain separate. */
final class DdAuditLogController extends Controller
{
    public function __invoke(Request $request, DataDictionaryIdentityResolver $identities): JsonResponse
    {
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $actor = $identities->resolve($login);
        abort_unless($actor !== null && DdRoleAccess::canReadAuditLog($actor['role']), 403);

        return response()->json(DB::table('jairoads_next.audit_logs')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(50, ['id', 'user_id', 'actor_identifier', 'action', 'entity_type', 'entity_id',
                'description', 'old_value', 'new_value', 'recipient_user_id', 'notification_message', 'created_at']));
    }
}
