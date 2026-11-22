<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\PreviewDataService;
use App\Services\RoleAccess;
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
            if ($remove) {
                // Validate metadata first. Only remove the attachment, never the parent row.
                $request->validate(['document_title' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:5000']]);
                $this->deletePrivateFile($request, 'document', $id);
            }
            $this->operations->updateDocument($request, $this->identities, $id);
        }

        $destination = self::BASE.'/maintenance-documents';
        if ($id !== null) {
            $document = $this->documentQuery($actor)->where('d.id', $id)->first();
            abort_unless($document !== null, 404);
            $destination = $this->relatedEditReturn($request, 'maintenance-documents', $id, (int) $document->project_id, (int) $document->maintenance_id);
        }

        return redirect($destination)->with('dd_operations_status', 'MaintenanceDocument saved.');
    }

    public function bulkDeleteDocument(Request $request): RedirectResponse
    {
        $actor = $this->actor($request);
        abort_unless(RoleAccess::canDeleteOperations($actor['role']), 403, 'Only administrators may delete documents.');

        $v = $request->validate(['document_ids' => ['required', 'array', 'min:1', 'max:100'], 'document_ids.*' => ['required', 'integer', 'min:1', 'distinct']]);
        $ids = array_map('intval', $v['document_ids']);
        abort_unless($this->documentQuery($actor)->whereIn('d.id', $ids)->count() === count($ids), 404);
        foreach ($ids as $id) {
            try {
                $this->fileDeletions->deleteDocumentRecord($request->user(), $id);
            } catch (HttpExceptionInterface $error) {
                throw ValidationException::withMessages(['file' => 'Document deletion unavailable or not confirmed. Refresh and review remaining records.']);
            }
        }

        return redirect($this->relatedReturn($request, $actor, self::BASE.'/maintenance-documents'))->with('dd_operations_status', 'Selected documents permanently deleted.');
    }
}
