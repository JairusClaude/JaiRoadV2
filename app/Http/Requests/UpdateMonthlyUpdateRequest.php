<?php

namespace App\Http\Requests;

use App\Models\MaintenanceRecord;
use App\Models\MonthlyUpdate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMonthlyUpdateRequest extends FormRequest
{
    /**
     * Only users authorized to update this monthly update
     * may submit the request.
     */
    public function authorize(): bool
    {
        $monthlyUpdate = $this->route('monthlyUpdate')
            ?? $this->route('monthly_update');

        return $monthlyUpdate instanceof MonthlyUpdate
            && (
                $this->user()?->can('update', $monthlyUpdate)
                ?? false
            );
    }

    /**
     * Get the validation rules for updating a monthly update.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $monthlyUpdate = $this->route('monthlyUpdate')
            ?? $this->route('monthly_update');

        $maintenanceRecord = new MaintenanceRecord;

        return [
            'maintenance_id' => [
                'required',
                'integer',
                Rule::exists(
                    $maintenanceRecord->getTable(),
                    $maintenanceRecord->getKeyName()
                ),
            ],

            'update_month' => [
                'required',
                'string',
                'size:7',
                'regex:/\A\d{4}-(0[1-9]|1[0-2])\z/',
                Rule::unique(
                    (new MonthlyUpdate)->getTable(),
                    'update_month'
                )
                    ->where(
                        'maintenance_id',
                        $this->input('maintenance_id')
                    )
                    ->ignore(
                        $monthlyUpdate instanceof MonthlyUpdate
                            ? $monthlyUpdate->getKey()
                            : null,
                        $monthlyUpdate instanceof MonthlyUpdate
                            ? $monthlyUpdate->getKeyName()
                            : 'id'
                    ),
            ],

            'progress_percentage' => [
                'required',
                'numeric',
                'decimal:0,2',
                'between:0,100',
            ],

            'summary_of_text_reports' => [
                'nullable',
                'string',
            ],
        ];
    }
}
