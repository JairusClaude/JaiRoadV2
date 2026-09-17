<?php

namespace Database\Seeders;

use App\Models\ProjectDocument;
use Illuminate\Database\Seeder;

class ProjectDocumentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        $projectDocuments = [
            [
                'document_title' => 'Document1',
                'description' => 'a document of a project',
                'file_name' => 'FIle1.docs',
                'file_path' => 'Projects/ProjectDocument/File1.docs',
                'maintenance_project_id' => 1,
                'uploaded_by' => 1,
            ],
            [
                'document_title' => 'Document2',
                'description' => 'a document of a project',
                'file_name' => 'FIle2.docs',
                'file_path' => 'Projects/ProjectDocument/File2.docs',
                'maintenance_project_id' => 2,
                'uploaded_by' => 2,
            ],
            [
                'document_title' => 'Document3',
                'description' => 'a document of a project',
                'file_name' => 'FIle3.docs',
                'file_path' => 'Projects/ProjectDocument/File3.docs',
                'maintenance_project_id' => 3,
                'uploaded_by' => 3,
            ],
            [
                'document_title' => 'Document4',
                'description' => 'a document of a project',
                'file_name' => 'FIle4.docs',
                'file_path' => 'Projects/ProjectDocument/File4.docs',
                'maintenance_project_id' => 4,
                'uploaded_by' => 4,
            ],

        ];
        foreach ($projectDocuments as $projectDocumentsData) {
            ProjectDocument::create($projectDocumentsData);
        }
    }
}
