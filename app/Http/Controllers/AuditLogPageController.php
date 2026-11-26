<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\AuditActorIdentifier;
use App\Services\AuditValues;
use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\LiteralDirectorySearch;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Response;

final class AuditLogPageController extends OperationsFrontendController
{
    public function index(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::auditIndex($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::managesBusinessData($actor['role']), 403);

        $search = LiteralDirectorySearch::normalize($request->query('search'));
        $action = LiteralDirectorySearch::option($request->query('action'));
        $sort = $request->query('sort') === 'oldest' ? 'oldest' : 'newest';

        $q = DB::table('jairoads_next.audit_logs as a')
            ->when($search !== '', function (Builder $query) use ($search) {
                $query->where(function (Builder $sub) use ($search) {
                    $term = LiteralDirectorySearch::pattern($search);
                    $sub->where('a.description', 'ilike', $term)
                        ->orWhere('a.actor_identifier', 'ilike', $term)
                        ->orWhereRaw("regexp_replace(a.actor_identifier, '^DD-UserAccount#', 'User Account #', 'i') ILIKE ?", [$term])
                        ->orWhere('a.entity_type', 'ilike', $term);
                });
            })
            ->when($action !== 'all', function (Builder $query) use ($action) {
                $query->where('a.action', $action);
            });

        $direction = $sort === 'oldest' ? 'asc' : 'desc';
        $events = $q->orderBy('a.id', $direction)
            ->paginate(15)
            ->withQueryString()
            ->through(function (\stdClass $row): array {
                $row->actor_identifier = AuditActorIdentifier::display($row->actor_identifier);
                $row->description = AuditActorIdentifier::description($row->description);
                foreach (['old_value', 'new_value'] as $field) {
                    $payload = $row->$field === null ? null : json_decode((string) $row->$field, true);
                    $row->$field = is_array($payload) && isset(AuditValues::TABLES[$row->entity_type])
                        ? app(AuditValues::class)->safe($row->entity_type, $payload) : null;
                }

                return (array) $row;
            });

        return $this->render('AuditLogs/Index', $request, [
            'events' => $events,
            'filters' => [
                'search' => $search,
                'action' => $action,
                'sort' => $sort,
            ],
            'navigationSection' => 'audit-logs',
        ]);
    }
}
