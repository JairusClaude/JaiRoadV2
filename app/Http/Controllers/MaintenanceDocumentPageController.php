<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PreviewDataService;
use App\Services\RoleAccess;
use App\Support\LiteralDirectorySearch;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Maintenance Document frontend pages. Shared identity, scoping, document
 * projections, file-deletion presentation and write adapters stay inherited.
 * Backend upload/update/download/deletion controllers remain unchanged.
 */
final class MaintenanceDocumentPageController extends OperationsFrontendController
{
    public function documentIndex(Request $request): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::documentIndex($request);
        }

        $actor = $this->actor($request);
        $filters = ['search' => LiteralDirectorySearch::normalize($request->query('search')), 'project' => LiteralDirectorySearch::option($request->query('project')),
            'sort' => $request->query('sort') === 'oldest' ? 'oldest' : 'newest'];
        $q = $this->documentQuery($actor)->when($filters['search'] !== '', fn (Builder $q) => $q->where('d.document_title', 'ilike', LiteralDirectorySearch::pattern($filters['search'])));
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
        if (self::isPreview($request)) {
            return PreviewDataService::documentShow($request, $id);
        }

        $actor = $this->actor($request);
        $d = $this->documentQuery($actor)->where('d.id', $id)->first();
        abort_unless($d !== null, 404);

        return $this->render('MaintenanceDocuments/Show', $request, ['document' => $this->documentData($d, $actor), 'canWrite' => $this->canWriteRecord($d, $actor)]);
    }

    public function documentForm(Request $request, ?int $id = null): Response
    {
        if (self::isPreview($request)) {
            return PreviewDataService::documentForm($request, $id);
        }

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
        $actor = $this->actor($request);
        $this->writer($actor);
        $request->validate(['remove_attachment' => ['sometimes', 'boolean']]);
        $remove = $request->boolean('remove_attachment');
        if ($remove) {
            $this->requirePrivateDeletion($request, $actor);
            abort_unless($id !== null && $this->documentQuery($actor)->where('d.id', $id)->exists(), 404);
        }
        if ($id === null) {
            // Validate the form alias before Symfony's FileBag receives it.
            $request->validate(['attachment' => ['required', 'file']]);
            $upload = Request::createFrom($request);
            $upload->files->set('file', $request->file('attachment'));
            $this->write(fn () => $this->operations->uploadDocument($upload, $this->identities, $this->documents), ['file' => 'attachment']);
        } else {
            $request->validate(['attachment' => ['prohibited']]);
            // Save and validate document metadata before any irreversible Storage I/O.
            // If attachment removal is unavailable, the file stays intact and
            // the user is told explicitly that this was a partial save.
            $this->operations->updateDocument($request, $this->identities, $id);
            if ($remove) {
                try {
                    $this->deletePrivateFile($request, 'document', $id);
                } catch (ValidationException $error) {
                    throw ValidationException::withMessages(['file' => 'Document details were saved, but attachment removal was not confirmed. Refresh the document and retry removal.']);
                }
            }
        }

        $destination = self::BASE.'/maintenance-documents';
        if ($id !== null) {
            $document = $this->documentQuery($actor)->where('d.id', $id)->first();
            abort_unless($document !== null, 404);
            $destination = $this->relatedEditReturn($request, 'maintenance-documents', $id, (int) $document->project_id, (int) $document->maintenance_id);
        }

        return redirect($destination)->with('jairoads_operations_status', 'MaintenanceDocument saved.');
    }

    public function bulkDeleteDocument(Request $request): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete documents.');

        $v = $request->validate(['document_ids' => ['required', 'array', 'min:1', 'max:100'], 'document_ids.*' => ['required', 'integer', 'min:1', 'distinct']]);
        $ids = array_map('intval', $v['document_ids']);
        $documents = $this->documentQuery($actor)->whereIn('d.id', $ids)->get(['d.id', 'd.file_path']);
        abort_unless($documents->count() === count($ids), 404);
        // Preflight EVERY file before deleting the first record. This avoids
        // predictable partial batches when a later object is not deletable.
        foreach ($documents as $document) {
            if ($document->file_path !== '') {
                $this->fileDeletions->preflight($request->user(), 'document', (int) $document->id, (string) $document->file_path);
            }
        }
        foreach ($ids as $id) {
            try {
                $this->fileDeletions->deleteDocumentRecord($request->user(), $id);
            } catch (ValidationException|HttpExceptionInterface $error) {
                throw ValidationException::withMessages(['file' => 'Document batch deletion was interrupted. Some records may already have been removed. Refresh and review what remains before retrying.']);
            }
        }

        return redirect($this->relatedReturn($request, $actor, self::BASE.'/maintenance-documents'))->with('jairoads_operations_status', 'Selected documents permanently deleted.');
    }
}
