<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateMaintenanceProjectRequest extends StoreMaintenanceProjectRequest
{
    public function authorize(): bool
    {
        $project = $this->route('maintenance_project');

        return $project instanceof MaintenanceProject && ($this->user()?->can('update', $project) ?? false);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $project = $this->route('maintenance_project');

        return [
            'project_title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'road_coverage_id' => ['bail', 'required', 'integer', 'exists:road_coverages,id', Rule::unique('maintenance_projects', 'road_coverage_id')->ignore($project instanceof MaintenanceProject ? $project->getKey() : null)],
            'created_by' => ['prohibited'],
            'created_at' => ['prohibited'],
            'updated_at' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->has('road_coverage_id')) {
                return;
            }
            $project = $this->route('maintenance_project');
            if ($project instanceof MaintenanceProject
                && (string) $this->input('road_coverage_id') !== (string) $project->road_coverage_id
                && $project->maintenanceRecords()->exists()) {
                $validator->errors()->add('road_coverage_id', 'Road coverage cannot be changed after maintenance history exists.');
            }
        });
    }
}
