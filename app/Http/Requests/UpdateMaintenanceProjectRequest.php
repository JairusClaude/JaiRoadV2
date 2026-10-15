
<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaintenanceProjectRequest extends FormRequest
{
    /**
     * Only users authorized by the MaintenanceProject policy
     * may update this project.
     */
    public function authorize(): bool
    {
        $maintenanceProject = $this->route('maintenanceProject');

        return $maintenanceProject instanceof MaintenanceProject
            && (
                $this->user()?->can(
                    'update',
                    $maintenanceProject
                ) ?? false
            );
    }

    /**
     * Get the validation rules for updating a maintenance project.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maintenanceProject = $this->route('maintenanceProject');
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
                    (new MaintenanceProject)->getTable(),
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
        ];
    }
}
