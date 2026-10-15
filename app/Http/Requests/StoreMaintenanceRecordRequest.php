
<?php

namespace App\Http\Requests;

use App\Models\Engineer;
use App\Models\MaintenanceProject;
use App\Models\MaintenanceRecord;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceRecordRequest extends FormRequest
{
    /**
     * Only users authorized by the MaintenanceRecord policy
     * may create maintenance records.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            MaintenanceRecord::class
        ) ?? false;
    }

    /**
     * Get the validation rules for creating a maintenance record.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $project = new MaintenanceProject;
        $engineer = new Engineer;

        return [
            'project_id' => [
                'required',
                'integer',
                Rule::exists(
                    $project->getTable(),
                    $project->getKeyName()
                ),
            ],

            'managing_engineer_id' => [
                'required',
                'integer',
                Rule::exists(
                    $engineer->getTable(),
                    $engineer->getKeyName()
                )->where('engineer_status', 'Active'),
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
