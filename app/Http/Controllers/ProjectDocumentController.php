<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectDocumentRequest;
use App\Http\Requests\UpdateProjectDocumentRequest;
use App\Models\MaintenanceProject;
use App\Models\ProjectDocument;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class ProjectDocumentController extends Controller
{
    public function index(): Response
    {
        $search = trim((string) request()->query('search', ''));
        $sortField = (string) request()->query('sort_field', 'created_at');
        $sortDirection = strtolower((string) request()->query('sort_direction', 'desc'));

        $allowedSortFields = [
            'document_title',
            'description',
            'file_name',
            'created_at',
        ];

        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        if (! in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $query = ProjectDocument::query();

        if ($search !== '') {
            $query->where(function (Builder $query) use ($search): void {
                $like = '%'.$search.'%';

                $query->where('document_title', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhere('file_name', 'like', $like);
            });
        }

        $model = $query
            ->orderBy($sortField, $sortDirection)
            ->paginate(5)
            ->withQueryString();

        return Inertia::render('ProjectDocuments/Index', [
            'model' => $model,
            'maintenanceProjects' => MaintenanceProject::query()
                ->orderBy('project_title')
                ->pluck('id', 'project_title'),
            'queryParams' => request()->query(),
        ]);
    }

    public function create(): void
    {
        //
    }

    public function store(
        StoreProjectDocumentRequest $request
    ): RedirectResponse {
        ProjectDocument::create($request->validated());

        return to_route('project-documents.index')
            ->with(
                'message',
                'Successfully uploaded a project document'
            );
    }

    public function show(ProjectDocument $projectDocument): void
    {
        //
    }

    public function edit(ProjectDocument $projectDocument): void
    {
        //
    }

    public function update(
        UpdateProjectDocumentRequest $request,
        ProjectDocument $projectDocument
    ): RedirectResponse {
        $projectDocument->update($request->validated());

        return to_route(
            'project-documents.index',
            $request->query()
        )->with(
            'message',
            'Successfully updated a project document'
        );
    }

    public function destroy(
        ProjectDocument $projectDocument
    ): RedirectResponse {
        $projectDocument->delete();

        return to_route('project-documents.index')
            ->with(
                'message',
                'Successfully deleted a project document'
            );
    }
}
