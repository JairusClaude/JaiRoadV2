<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\MonthlyUpdates\CanonicalMonthlyWriteGate;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Response;

/**
 * Monthly Update frontend pages. The parent retains shared read/write helpers
 * while resource-specific page actions are extracted incrementally.
 */
final class MonthlyUpdatePageController extends OperationsFrontendController
{
    public function updateIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $sort = $request->query('sort');
        $year = $request->string('year', 'all')->toString();
        $year = ctype_digit($year) && strlen($year) <= 4 ? (string) (int) $year : 'all';
        $filters = ['search' => $request->string('search')->toString(), 'project' => $request->string('project', 'all')->toString(),
            'year' => $year,
            'sort' => is_string($sort) && in_array($sort, ['newest', 'oldest', 'modified'], true) ? $sort : 'newest'];
        $authorized = $this->updateQuery($actor);
        $q = (clone $authorized)->when($filters['search'] !== '', fn (Builder $q) => $q->where('p.project_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
        if (ctype_digit($filters['project'])) {
            $q->where('p.id', $filters['project']);
        }
        if ($filters['year'] !== 'all') {
            // update_month is checked, zero-padded varchar(7), not a date.
            // Keep the column bare in predicates so a suitable B-tree can use the bounds.
            $bound = str_pad($filters['year'], 4, '0', STR_PAD_LEFT);
            $q->where('u.update_month', '>=', $bound.'-01')
                ->where('u.update_month', '<=', $bound.'-12');
        }
        $direction = $filters['sort'] === 'oldest' ? 'asc' : 'desc';
        $q->orderBy($filters['sort'] === 'modified' ? 'u.updated_at' : 'u.update_month', $direction)
            ->orderBy('u.id', $direction);

        return $this->render('MonthlyUpdates/Index', $request, [
            'updates' => $q->paginate(12)->withQueryString()->appends($filters)->through(fn (\stdClass $u): array => $this->updateData($u, $actor)),
            'projects' => $this->projectChoices($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectChoiceData($p)),
            // Choice projection only; filtering above does not apply a function to the column.
            'years' => (clone $authorized)->select([])->selectRaw('substring(u.update_month, 1, 4)::integer as reporting_year')
                ->distinct()->orderByDesc('reporting_year')->pluck('reporting_year'),
            'filters' => $filters, 'canWrite' => $this->writable($actor) && CanonicalMonthlyWriteGate::enabled(),
        ]);
    }

    public function updateForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        CanonicalMonthlyWriteGate::enforce();
        $u = $id === null ? null : $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_if($id !== null && $u === null, 404);
        abort_if($u !== null && ! $this->canWriteRecord($u, $actor), 403);

        $parents = $this->parents($actor, $request, $u === null ? null : (int) $u->maintenance_id);

        return $this->render('MonthlyUpdates/Create', $request, $parents + [
            'update' => $u === null ? null : $this->updateData($u, $actor), 'media' => $id === null ? [] : $this->mediaData($id, $actor),
            'existingUpdates' => $this->updateQuery($actor)->when($parents['contextRecordId'] !== null, fn (Builder $q) => $q->where('u.maintenance_id', $parents['contextRecordId']))->get(['u.id', 'u.maintenance_id', 'u.update_month']),
            'submitUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/monthly-updates'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function saveUpdate(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        CanonicalMonthlyWriteGate::enforce();
        // The canonical upload workflow compensates storage one file at a time.
        // Do not pretend a batch of preview attachments is an atomic report save.
        $request->validate(['attachments' => ['prohibited'], 'removed_media_ids' => ['prohibited']]);
        $this->operations->saveUpdate($request, $this->identities, $id);
        $id ??= (int) DB::table('jairoads_next.monthly_updates')->where('maintenance_id', $request->input('maintenance_id'))
            ->where('update_month', $request->input('update_month'))->value('id');

        return redirect(self::BASE.'/monthly-updates/'.$id)->with('dd_operations_status', 'MonthlyUpdate saved. Media can be uploaded separately below.');
    }

    public function updateShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $u = $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_unless($u !== null, 404);

        return $this->render('MonthlyUpdates/Show', $request, [
            'update' => $this->updateData($u, $actor), 'media' => $this->mediaData($id, $actor), 'canWrite' => $this->canWriteRecord($u, $actor) && CanonicalMonthlyWriteGate::enabled(),
            'canUploadMedia' => $this->canWriteRecord($u, $actor) && CanonicalMonthlyWriteGate::enabled() && $this->media->configured(),
            'backUrl' => self::BASE.'/monthly-updates', 'backLabel' => 'Monthly Updates', 'directoryUrl' => self::BASE.'/monthly-updates',
        ]);
    }

    public function uploadMedia(Request $request, int $id): RedirectResponse
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        CanonicalMonthlyWriteGate::enforce();
        $u = $this->updateQuery($actor)->where('u.id', $id)->first();
        abort_unless($u !== null, 404);
        $request->merge(['monthly_update_id' => $id]);
        $this->operations->uploadMedia($request, $this->identities, $this->media);

        return redirect(self::BASE.'/monthly-updates/'.$id)->with('dd_operations_status', 'Private media uploaded.');
    }
}
