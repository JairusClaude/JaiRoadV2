<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Maintenance Document frontend pages. Shared identity, scoping, document
 * projections, file-deletion presentation and write adapters stay inherited.
 * Backend upload/update/download/deletion controllers remain unchanged.
 */
final class MaintenanceDocumentPageController extends OperationsFrontendController
{
    public function documentIndex(Request $request): Response
    {
        $actor = $this->actor($request);
        $filters = ['search' => $request->string('search')->toString(), 'project' => $request->string('project', 'all')->toString(),
            'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->documentQuery($actor)->when($filters['search'] !== '', fn (Builder $q) => $q->where('d.document_title', 'ilike', '%'.substr($filters['search'], 0, 255).'%'));
        if (ctype_digit($filters['project'])) {
            $q->where('p.id', $filters['project']);
        }

        return $this->render('MaintenanceDocuments/Index', $request, [
            'documents' => $q->orderBy('d.id', $filters['sort'] === 'oldest' ? 'asc' : 'desc')->paginate(12)->withQueryString()->through(fn (\stdClass $d): array => $this->documentData($d, $actor)),
            'projects' => $this->projectChoices($actor)->orderBy('p.project_title')->get()->map(fn (\stdClass $p): array => $this->projectChoiceData($p)),
            'filters' => $filters, 'canWrite' => $this->writable($actor),
        ]);
    }

    public function documentShow(Request $request, int $id): Response
    {
        $actor = $this->actor($request);
        $d = $this->documentQuery($actor)->where('d.id', $id)->first();
        abort_unless($d !== null, 404);

        return $this->render('MaintenanceDocuments/Show', $request, ['document' => $this->documentData($d, $actor), 'canWrite' => $this->canWriteRecord($d, $actor)]);
    }

    public function documentForm(Request $request, ?int $id = null): Response
    {
        $actor = $this->actor($request);
        $this->writer($actor);
        $d = $id === null ? null : $this->documentQuery($actor)->where('d.id', $id)->first();
        abort_if($id !== null && $d === null, 404);
        abort_if($d !== null && ! $this->canWriteRecord($d, $actor), 403);

        return $this->render('MaintenanceDocuments/Form', $request, $this->parents($actor, $request, $d === null ? null : (int) $d->maintenance_id) + [
            'document' => $d === null ? null : $this->documentData($d, $actor),
            'submitUrl' => self::BASE.'/maintenance-documents'.($id === null ? '' : '/'.$id),
            'cancelUrl' => self::BASE.'/maintenance-documents'.($id === null ? '' : '/'.$id),
        ]);
    }

    public function saveDocument(Request $request, ?int $id = null): RedirectResponse
    {
        $this->writer($this->actor($request));
        if ($id === null) {
            // Validate the form alias before Symfony's FileBag receives it.
            $request->validate(['attachment' => ['required', 'file']]);
            $upload = Request::createFrom($request);
            $upload->files->set('file', $request->file('attachment'));
            $this->write(fn () => $this->operations->uploadDocument($upload, $this->identities, $this->documents), ['file' => 'attachment']);
        } else {
            $request->validate(['attachment' => ['prohibited']]);
            $this->operations->updateDocument($request, $this->identities, $id);
        }

        return redirect(self::BASE.'/maintenance-documents'.($id === null ? '' : '/'.$id))->with('dd_operations_status', 'MaintenanceDocument saved.');
    }
}
