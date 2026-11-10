<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\AuditValues;
use App\Services\RoleAccess;
use App\Services\SecurityMonitoring\AuthenticationTelemetry;
use App\Services\SecurityMonitoring\OnlinePresence;
use App\Services\SecurityMonitoring\SessionCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Admin/SuperAdmin-only read endpoint. Never changes or consolidates history. */
final class AuditHistoryController extends Controller
{
    public function __invoke(Request $request, AccountIdentityResolver $resolver): Response
    {
        $user = $request->user();
        $actor = $user instanceof User ? $resolver->resolve($user) : null;
        abort_unless($actor !== null && RoleAccess::managesBusinessData($actor['role']), 403);
        $actions = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'REASSIGN', 'RETIRE', 'LOGIN', 'LOGOUT'];
        $v = $request->validate([
            'activity_search' => ['nullable', 'string', 'max:150'], 'activity_action' => ['nullable', Rule::in($actions)],
            'activity_entity' => ['nullable', Rule::in(array_keys(AuditValues::TABLES))],
            'activity_order' => ['nullable', Rule::in(['newest', 'oldest'])],
            'activity_from' => ['nullable', 'date_format:Y-m-d'], 'activity_to' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('activity_from'), 'after_or_equal:activity_from')],
            'auth_search' => ['nullable', 'string', 'max:150'], 'auth_event' => ['nullable', Rule::in(['LOGIN', 'LOGOUT', 'FAILED_LOGIN'])],
            'auth_from' => ['nullable', 'date_format:Y-m-d'], 'auth_to' => ['nullable', 'date_format:Y-m-d', Rule::when($request->filled('auth_from'), 'after_or_equal:auth_from')],
        ]);
        $filters = array_map(static fn ($value) => $value ?? '', $v);
        $query = DB::table('jairoads_next.audit_logs as audit')->leftJoin('jairoads_next.user_accounts as account', 'account.id', '=', 'audit.user_id');
        if (! empty($v['activity_search'])) {
            $search = '%'.$v['activity_search'].'%';
            $query->where(static fn (Builder $q) => $q->where('audit.actor_identifier', 'ilike', $search)->orWhere('account.username', 'ilike', $search)
                ->orWhere('audit.description', 'ilike', $search)->orWhereRaw('CAST(audit.entity_id AS text) ILIKE ?', [$search]));
        }
        if (! empty($v['activity_action'])) {
            $query->where('audit.action', $v['activity_action']);
        }
        if (! empty($v['activity_entity'])) {
            $query->where('audit.entity_type', $v['activity_entity']);
        }
        $this->dates($query, $v, 'activity', 'audit.created_at');
        $direction = ($v['activity_order'] ?? 'newest') === 'oldest' ? 'asc' : 'desc';
        $events = $query->orderBy('audit.created_at', $direction)->orderBy('audit.id', $direction)
            ->paginate(25, ['audit.id', 'audit.user_id', 'audit.actor_identifier', 'audit.action', 'audit.entity_type', 'audit.entity_id', 'audit.description',
                'audit.old_value', 'audit.new_value', 'audit.recipient_user_id', 'audit.notification_message', 'audit.created_at', 'account.account_type as current_account_type'])
            ->withQueryString()->through(function (\stdClass $row): array {
                foreach (['old_value', 'new_value'] as $field) {
                    $payload = $row->$field === null ? null : json_decode($row->$field, true);
                    $row->$field = is_array($payload) && isset(AuditValues::TABLES[$row->entity_type])
                        ? app(AuditValues::class)->safe($row->entity_type, $payload) : null;
                }
                $row->created_at = CarbonImmutable::parse($row->created_at, 'UTC')->utc()->toIso8601String();

                return (array) $row;
            });
        $available = app(AuthenticationTelemetry::class)->available();
        $collecting = $available && config('security-monitoring.enabled') && app(AuthenticationTelemetry::class)->available(true);
        $authentication = new LengthAwarePaginator([], 0, 25, max(1, $request->integer('auth_page', 1)), ['path' => $request->url(), 'pageName' => 'auth_page']);
        $success = $failures = 0;
        if ($available) {
            $auth = DB::table(AuthenticationTelemetry::EVENTS);
            $this->dates($auth, $v, 'auth', 'created_at');
            $success = (clone $auth)->where('event', 'LOGIN')->count();
            $failures = (clone $auth)->where('event', 'FAILED_LOGIN')->count();
            if (! empty($v['auth_event'])) {
                $auth->where('event', $v['auth_event']);
            }
            if (! empty($v['auth_search'])) {
                $search = '%'.$v['auth_search'].'%';
                $reference = SessionCatalog::reference(mb_strtolower(trim($v['auth_search'])), 'attempt');
                $auth->where(static fn (Builder $q) => $q->where('actor_identifier', 'ilike', $search)->orWhere('attempted_identifier', 'ilike', $search)->orWhere('attempt_reference', $reference));
            }
            $authentication = $auth->orderByDesc('created_at')->orderByDesc('id')->paginate(25,
                ['id', 'user_account_id', 'actor_identifier', 'account_type', 'attempted_identifier', 'event', 'outcome', 'method', 'client_description', 'created_at'], 'auth_page')
                ->withQueryString()->through(static function (\stdClass $row): array {
                    $row->created_at = CarbonImmutable::parse($row->created_at, 'UTC')->utc()->toIso8601String();

                    return (array) $row;
                });
        }
        $presence = app(OnlinePresence::class)->read();

        $summary = ['system_activities' => DB::table('jairoads_next.audit_logs')->whereIn('action', ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'REASSIGN', 'RETIRE'])->count(), 'logins' => $available ? $success : null, 'failed_logins' => $available ? $failures : null, 'online_accounts' => $presence['available'] ? $presence['total'] : null];
        abort_unless($resolver->resolve($user) === $actor, 403);

        return Inertia::render('dd-phase3/AuditHistory', ['events' => $events, 'authentication' => $authentication,
            'presence' => $presence, 'filters' => $filters, 'actions' => $actions, 'entities' => array_keys(AuditValues::TABLES),
            'monitoring' => ['available' => $available, 'collecting' => $collecting, 'recent_failure_at' => app(AuthenticationTelemetry::class)->recentFailure(), 'message' => $available
                ? (! $collecting ? 'Collection is disabled or unavailable; retained authentication history remains read-only.' : 'Separate, best-effort security telemetry. Failed attempts are masked and rate-bounded; outages may leave gaps. No IP addresses are stored.')
                : 'Authentication monitoring is unavailable until its auxiliary schema and runtime permissions are approved and activated. Business history remains available.'],
            'summary' => $summary,
        ]);
    }

    /** UI calendar dates are Asia/Manila; stored timestamps remain UTC. Range predicates avoid date casts. */
    /** @param array<string,mixed> $v */
    private function dates(Builder $query, array $v, string $prefix, string $column): void
    {
        if (! empty($v[$prefix.'_from'])) {
            $query->where($column, '>=', CarbonImmutable::parse($v[$prefix.'_from'], 'Asia/Manila')->startOfDay()->utc()->toIso8601String());
        }
        if (! empty($v[$prefix.'_to'])) {
            $query->where($column, '<', CarbonImmutable::parse($v[$prefix.'_to'], 'Asia/Manila')->addDay()->startOfDay()->utc()->toIso8601String());
        }
    }
}
