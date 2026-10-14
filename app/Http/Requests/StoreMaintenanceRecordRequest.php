<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'maintenance_projects_id' => [
                'required',
                'integer',
                'exists:maintenance_projects,id',
            ],
            'engineers_id' => [
                'required',
                'integer',
                'exists:engineers,id',
            ],
            'maintenance_year' => [
                'required',
                'integer',
                'min:2000',
                'max:2100',
            ],
            'quarter' => [
                'required',
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
                'nullable',
                'date',
                'after_or_equal:start_date',
            ],
            'status' => [
                'required',
                'string',
                Rule::in([
                    'Pending',
                    'Ongoing',
                    'Completed',
                    'Suspended',
                ]),
            ],
            'description' => [
                'required',
                'string',
            ],
            'created_by' => [
                'required',
                'integer',
                'exists:user_accounts,id',
            ],
        ];
    }
}
