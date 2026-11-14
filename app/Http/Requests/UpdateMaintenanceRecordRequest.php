<?php

namespace App\Http\Requests;

use App\Models\MaintenanceProject;
use App\Models\MaintenanceRecord;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaintenanceRecordRequest extends FormRequest
{
    /**
     * Only users authorized by the MaintenanceRecord policy
     * may update this record.
     */
    public function authorize(): bool
    {
        $maintenanceRecord = $this->route('maintenanceRecord');

        return $maintenanceRecord instanceof MaintenanceRecord
            && (
                $this->user()?->can(
                    'update',
                    $maintenanceRecord
                ) ?? false
            );
    }

    /**
     * Get the validation rules for updating a maintenance record.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $project = new MaintenanceProject;

        return [
            'project_id' => [
                'required',
                'integer',
                Rule::exists(
                    $project->getTable(),
                    $project->getKeyName()
                ),
            ],

            'maintenance_year' => [
                'required',
                'integer',
                'min:1',
                'max:9999',
            ],

            'quarter' => [
                'required',
                'string',
                'size:2',
                Rule::in(['Q1', 'Q2', 'Q3', 'Q4']),
            ],

            'start_date' => [
                'required',
                'date',
            ],

            'estimated_duration_days' => [
                'required',
                'integer',
                'min:1',
            ],

            'complete_date' => [
                Rule::requiredIf(
                    fn () => $this->input('status') === 'Completed'
                ),
                Rule::prohibitedIf(
                    fn () => $this->input('status') === 'Ongoing'
                ),
                'nullable',
                'date',
                'after_or_equal:start_date',
            ],

            'status' => [
                'required',
                'string',
                'max:20',
                Rule::in(['Ongoing', 'Completed']),
            ],

            'description' => [
                'nullable',
                'string',
            ],
        ];
    }
}
