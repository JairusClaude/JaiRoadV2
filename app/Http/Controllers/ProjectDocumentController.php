<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectDocumentRequest;
use App\Http\Requests\UpdateProjectDocumentRequest;
use App\Models\MaintenanceProject;
use App\Models\ProjectDocument;
use Inertia\Inertia;

class ProjectDocumentController extends Controller
{
    public function index()
    {
        $model = ProjectDocument::query()
            ->where(
                'document_title',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'description',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orWhere(
                'file_name',
                'like',
                '%'.request()->query('search').'%'
            )
            ->orderBy(
                request('sort_field', 'created_at'),
                request('sort_direction', 'desc')
            )
            ->paginate(5)
            ->appends(request()->query());

        return Inertia::render('ProjectDocuments/Index', [
            'model' => $model,
            'maintenanceProjects' =>
                MaintenanceProject::orderBy(
                    'project_title',
                    'asc'
                )->pluck('id', 'project_title'),
            'queryParams' => request()->query(),
        ]);
    }

    public function create()
    {
        //
    }

    public function store(
        StoreProjectDocumentRequest $request
    ) {
        ProjectDocument::create(
            $request->validated()
        );

        session()->flash(
            'message',
            'Successfully uploaded a project document'
        );

        return redirect(
            route('project-documents.index')
        );
    }

    public function show(ProjectDocument $projectDocument)
    {
        //
    }

    public function edit(ProjectDocument $projectDocument)
    {
        //
    }

    public function update(
        UpdateProjectDocumentRequest $request,
        ProjectDocument $projectDocument
    ) {
        $projectDocument->update(
            $request->validated()
        );

        session()->flash(
            'message',
            'Successfully updated a project document'
        );

        return redirect(
            route(
                'project-documents.index',
                $request->query()
            )
        );
    }

    public function destroy(
        ProjectDocument $projectDocument
    ) {
        $projectDocument->delete();

        session()->flash(
            'message',
            'Successfully deleted a project document'
        );

        return redirect(
            route('project-documents.index')
        );
    }
}