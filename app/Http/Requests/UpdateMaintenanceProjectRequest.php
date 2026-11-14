<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaintenanceProjectRequest extends FormRequest
{
    /**
     * Only authorized users may update a maintenance project.
     */
    public function authorize(): bool
    {
        $maintenanceProject = $this->route('maintenanceProject')
            ?? $this->route('maintenance_project');

        return $maintenanceProject instanceof MaintenanceProject
            && (
                $this->user()?->can(
                    'update',
                    $maintenanceProject
                ) ?? false
            );
    }

    /**
     * Validate the maintenance-project update form.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maintenanceProject = $this->route('maintenanceProject')
            ?? $this->route('maintenance_project');

        if (! $maintenanceProject instanceof MaintenanceProject) {
            return [];
        }

        $project = new MaintenanceProject;
        $roadCoverage = new RoadCoverage;

        return [
            'project_title' => [
                'required',
                'string',
                'max:255',
            ],

            'road_coverage_id' => [
                'required',
                'integer',

                Rule::exists(
                    $roadCoverage->getTable(),
                    $roadCoverage->getKeyName()
                ),

                Rule::unique(
                    $project->getTable(),
                    'road_coverage_id'
                )->ignore(
                    $maintenanceProject->getKey(),
                    $maintenanceProject->getKeyName()
                ),
            ],

            'description' => [
                'nullable',
                'string',
            ],

            // Do not allow the client to override protected fields.
            'created_by' => ['prohibited'],
            'created_at' => ['prohibited'],
            'updated_at' => ['prohibited'],
        ];
    }
}
