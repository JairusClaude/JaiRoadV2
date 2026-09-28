<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMaintenanceProjectRequest extends FormRequest
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
            'project_title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'status' => ['required', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date'],
            'gravelled_road_in_km' => ['required', 'integer', 'min:0'],
            'lgus_id' => ['required', 'integer', 'exists:lgus,id'],
            'engineers_id' => ['required', 'integer', 'exists:engineers,id'],
            'created_by' => ['required', 'integer', 'exists:user_accounts,id'],
        ];
    }
}
