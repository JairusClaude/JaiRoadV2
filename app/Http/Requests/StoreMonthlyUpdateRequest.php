<?php

namespace App\Http\Requests;

use App\Models\MaintenanceRecord;
use App\Models\MonthlyUpdate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMonthlyUpdateRequest extends FormRequest
{
    /**
     * Only users authorized by the MonthlyUpdate policy may create updates.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            MonthlyUpdate::class
        ) ?? false;
    }

    /**
     * Get the validation rules for creating a monthly update.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maintenanceRecord = new MaintenanceRecord();
        $monthlyUpdate = new MonthlyUpdate();

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
                    $monthlyUpdate->getTable(),
                    'update_month'
                )->where(
                    'maintenance_id',
                    $this->input('maintenance_id')
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
