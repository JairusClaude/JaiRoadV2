<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\PreservedProjectDeletion;
use App\Services\RoleAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

final class PreservedHistoryController extends Controller
{
    public function __construct(private AccountIdentityResolver $identities, private PreservedProjectDeletion $deletions) {}

    private function login(Request $request): User
    {
        $login = $request->user();
        abort_unless($login instanceof User, 403);
        $actor = $this->identities->resolve($login);
        abort_unless($actor !== null && RoleAccess::managesBusinessData($actor['role']), 403);

        return $login;
    }

    public function preview(Request $request, int $id): JsonResponse
    {
        return response()->json($this->deletions->preview($this->login($request), $id))->header('Cache-Control', 'private, no-store');
    }

    public function delete(Request $request, int $id): JsonResponse|RedirectResponse
    {
        $login = $this->login($request);
        $v = $request->validate(['confirmation_token' => ['required', 'string']]);
        $this->deletions->confirm($login, $id, $v['confirmation_token']);

        if ($request->expectsJson()) {
            return response()->json(['state' => 'completed', 'message' => 'Empty MaintenanceProject deleted successfully.']);
        }

        return redirect('/dd-phase3/ui/maintenance-projects')->with('dd_operations_status', 'Empty MaintenanceProject deleted successfully.');
    }

    private function records(): Builder
    {
        abort_unless($this->deletions->available(), 503, 'Schema-owner setup is required for preserved project history.');

        return DB::table('jairoads_next.maintenance_records as r')
            ->join(PreservedProjectDeletion::CONTEXT.' as h', 'h.maintenance_id', '=', 'r.id')
            ->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'r.managing_engineer_id')
            ->whereNull('r.project_id')->select(['r.*', 'h.previous_project_id', 'h.snapshot', 'h.detached_at', 'e.first_name', 'e.last_name']);
    }

    public function index(Request $request): Response
    {
        $this->login($request);
        $q = $this->records();
        $search = substr($request->string('search')->toString(), 0, 255);
        if ($search !== '') {
            $q->whereRaw("h.snapshot->'previous_project'->>'project_title' ILIKE ?", ['%'.$search.'%']);
        }

        return Inertia::render('MaintenanceRecords/PreservedHistory', ['records' => $q->orderByDesc('r.id')->paginate(12)->withQueryString()->through(fn (\stdClass $r): array => $this->data($r)),
            'record' => null, 'search' => $search, 'canonicalFrontend' => true]);
    }

    /** @return array<string,mixed> */
    private function data(\stdClass $row): array
    {
        return ['id' => (int) $row->id, 'project_id' => null,
            'managing_engineer_id' => $row->managing_engineer_id === null ? null : (int) $row->managing_engineer_id,
            'manager_name' => $row->managing_engineer_id === null ? null : trim($row->first_name.' '.$row->last_name),
            'maintenance_year' => (int) $row->maintenance_year, 'quarter' => $row->quarter, 'status' => $row->status,
            'start_date' => $row->start_date, 'estimated_duration_days' => $row->estimated_duration_days, 'complete_date' => $row->complete_date,
            'description' => $row->description, 'created_by' => (int) $row->created_by,
            'previous_project_id' => (int) $row->previous_project_id, 'historical_context' => json_decode($row->snapshot, true, 512, JSON_THROW_ON_ERROR),
            'detached_at' => $row->detached_at, 'details_url' => '/dd-phase3/history/records/'.$row->id];
    }

    public function show(Request $request, int $id): Response
    {
        $this->login($request);
        $record = $this->records()->where('r.id', $id)->first();
        abort_unless($record !== null, 404);
        $updates = DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $id)->orderByDesc('update_month')->orderByDesc('id');
        $documents = DB::table('jairoads_next.maintenance_documents')->where('maintenance_id', $id)->orderByDesc('id');
        $media = DB::table('jairoads_next.media as f')->join('jairoads_next.monthly_updates as u', 'u.id', '=', 'f.monthly_update_id')
            ->where('u.maintenance_id', $id)->orderByDesc('f.id')->select(['f.id', 'f.file_name', 'f.monthly_update_id', 'f.uploaded_by']);

        return Inertia::render('MaintenanceRecords/PreservedHistory', ['records' => null, 'record' => $this->data($record), 'canonicalFrontend' => true,
            'updates' => $updates->paginate(10, ['id', 'update_month', 'progress_percentage', 'summary_of_text_reports', 'created_by'], 'updates_page')->withQueryString(),
            'documents' => $documents->paginate(10, ['id', 'document_title', 'file_name', 'uploaded_by'], 'documents_page')->withQueryString(),
            'media' => $media->paginate(10, ['*'], 'media_page')->withQueryString()]);
    }
}
