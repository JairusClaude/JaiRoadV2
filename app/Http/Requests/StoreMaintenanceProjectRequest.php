<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Existing policy remains fail-closed while shared identity is unresolved.
        return $this->user()?->can('create', MaintenanceProject::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'project_title' => is_string($this->project_title) ? trim($this->project_title) : $this->project_title,
            'description' => is_string($this->description) ? trim($this->description) ?: null : $this->description,
        ]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'project_title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'road_coverage_id' => ['bail', 'required', 'integer', 'exists:road_coverages,id', Rule::unique('maintenance_projects', 'road_coverage_id')],
            'created_by' => ['prohibited'],
            'created_at' => ['prohibited'],
            'updated_at' => ['prohibited'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['road_coverage_id.unique' => 'This road coverage is already assigned to another project. Choose an available coverage.'];
    }
}
