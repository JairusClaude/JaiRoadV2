<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use Illuminate\Foundation\Http\FormRequest;

class BulkDeleteMaintenanceProjectsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('deleteAny', MaintenanceProject::class) ?? false;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'project_ids' => ['required', 'array', 'min:1', 'max:100'],
            'project_ids.*' => ['bail', 'required', 'integer', 'min:1', 'distinct', 'exists:maintenance_projects,id'],
        ];
    }
}
