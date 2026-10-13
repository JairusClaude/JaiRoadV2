<?php

namespace Database\Factories;

use App\Models\MaintenanceProject;
use App\Models\ProjectDocument;
use App\Models\UserAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectDocument>
 */
class ProjectDocumentFactory extends Factory
{
    protected $model = ProjectDocument::class;

    public function definition(): array
    {
        $fileName = fake()->uuid() . '.pdf';

        return [
            'document_title' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'file_name' => $fileName,
            'file_path' => 'project-documents/' . $fileName,
            'maintenance_projects_id' => MaintenanceProject::factory(),
            'uploaded_by' => UserAccount::factory(),
        ];
    }
}
