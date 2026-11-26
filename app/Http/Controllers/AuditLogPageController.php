<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\LiteralDirectorySearch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/** Compatibility bookmarks use the same privileged monitoring UI as the sidebar. */
final class AuditLogPageController extends OperationsFrontendController
{
    public function index(Request $request): Response|RedirectResponse
    {
        if (self::isPreview($request)) {
            return PreviewDataService::auditIndex($request);
        }

        $actor = $this->actor($request);
        abort_unless(RoleAccess::managesBusinessData($actor['role']), 403);

        $params = [];
        $search = LiteralDirectorySearch::normalize($request->query('activity_search', $request->query('search')));
        if ($search !== '') {
            $params['activity_search'] = $search;
        }
        $action = LiteralDirectorySearch::option($request->query('activity_action', $request->query('action')));
        if (in_array($action, AuditHistoryController::ACTIVITY_ACTIONS, true)) {
            $params['activity_action'] = $action;
        }
        if ($request->query('activity_order', $request->query('sort')) === 'oldest') {
            $params['activity_order'] = 'oldest';
        }
        $page = $request->integer('page', 1);
        if ($page > 1) {
            $params['page'] = $page;
        }

        return redirect()->route('jairoads.workspace.audit.index', $params);
    }
}
