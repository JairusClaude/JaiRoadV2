<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreMonthlyUpdateRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'update_month' => ['required', 'string', 'max:255'],
            'progress_percentage' => ['required', 'integer', 'min:0', 'max:100'],
            'summary_of_text_reports' => ['required', 'string'],
            'created_by' => ['required', 'integer', 'exists:user_accounts,id'],
            'maintenance_projects_id' => ['required', 'integer', 'exists:maintenance_projects,id'],
        ];
    }
}
