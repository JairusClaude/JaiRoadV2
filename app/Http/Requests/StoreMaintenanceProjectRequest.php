<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceProjectRequest extends FormRequest
{
    /**
     * Only users authorized to create maintenance projects may proceed.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            MaintenanceProject::class
        ) ?? false;
    }

    /**
     * Validate the fields submitted by the create-project form.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'project_title' => [
                'required',
                'string',
                'max:255',
            ],

            'road_coverage_id' => [
                'required',
                'integer',
                Rule::exists('road_coverages', 'id'),
                Rule::unique(
                    'maintenance_projects',
                    'road_coverage_id'
                ),
            ],

            'description' => [
                'nullable',
                'string',
            ],

            // These fields must be controlled by the backend.
            'created_by' => ['prohibited'],
            'created_at' => ['prohibited'],
            'updated_at' => ['prohibited'],
        ];
    }
}
