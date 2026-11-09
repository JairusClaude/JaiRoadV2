<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\AuditValues;
use App\Services\RoleAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Privileged read-only history, including retained historical copies/LOGIN. */
final class AuditHistoryController extends Controller
{
    public function __invoke(Request $request, AccountIdentityResolver $resolver): Response
    {
        $user = $request->user();
        $actor = $user instanceof User ? $resolver->resolve($user) : null;
        abort_unless($actor !== null && RoleAccess::managesBusinessData($actor['role']), 403);
        $events = DB::table('jairoads_next.audit_logs')->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(25, ['id', 'user_id', 'actor_identifier', 'action', 'entity_type', 'entity_id', 'description', 'old_value', 'new_value', 'recipient_user_id', 'notification_message', 'created_at'])
            ->withQueryString()->through(function (\stdClass $row): array {
                foreach (['old_value', 'new_value'] as $field) {
                    $payload = $row->$field === null ? null : json_decode($row->$field, true);
                    $row->$field = is_array($payload) && isset(AuditValues::TABLES[$row->entity_type])
                        ? app(AuditValues::class)->safe($row->entity_type, $payload) : null;
                }

                return (array) $row;
            });

        return Inertia::render('dd-phase3/AuditHistory', ['events' => $events]);
    }
}
