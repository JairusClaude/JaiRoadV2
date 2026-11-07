<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdAuditValues;
use App\Services\DataDictionary\DdRoleAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Privileged read-only history, including retained historical copies/LOGIN. */
final class DdAuditHistoryController extends Controller
{
    public function __invoke(Request $request, DataDictionaryIdentityResolver $resolver): Response
    {
        $user = $request->user();
        $actor = $user instanceof User ? $resolver->resolve($user) : null;
        abort_unless($actor !== null && DdRoleAccess::managesBusinessData($actor['role']), 403);
        $events = DB::table('jairoads_next.audit_logs')->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(25, ['id', 'user_id', 'actor_identifier', 'action', 'entity_type', 'entity_id', 'description', 'old_value', 'new_value', 'recipient_user_id', 'notification_message', 'created_at'])
            ->withQueryString()->through(function (\stdClass $row): array {
                foreach (['old_value', 'new_value'] as $field) {
                    $payload = $row->$field === null ? null : json_decode($row->$field, true);
                    $row->$field = is_array($payload) && isset(DdAuditValues::TABLES[$row->entity_type])
                        ? app(DdAuditValues::class)->safe($row->entity_type, $payload) : null;
                }

                return (array) $row;
            });

        return Inertia::render('dd-phase3/AuditHistory', ['events' => $events]);
    }
}
