<?php

namespace Database\Factories;

use App\Models\ProjectDocument;
use App\Models\MaintenanceProject;
use App\Models\UserAccount;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectDocument>
 */
class ProjectDocumentFactory extends Factory
{
    protected $model = ProjectDocument::class;
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'document_title' => $this->faker->sentence(3),
            'description' => $this->faker->paragraph(),
            'file_name' => $this->faker->word(),
            'file_path' => $this->faker->filePath(),

            'maintenance_project_id' => MaintenanceProject::factory(),
            'uploaded_by' => UserAccount::factory(),
        ];
    }
}
