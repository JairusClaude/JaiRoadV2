
<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceProjectRequest extends FormRequest
{
    /**
     * Only users authorized by the MaintenanceProject policy
     * may create maintenance projects.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            MaintenanceProject::class
        ) ?? false;
    }

    /**
     * Get the validation rules for creating a maintenance project.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $roadCoverage = new RoadCoverage();
        $maintenanceProject = new MaintenanceProject();

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
                    $maintenanceProject->getTable(),
                    'road_coverage_id'
                ),
            ],

            'description' => [
                'nullable',
                'string',
            ],
        ];
    }
}
