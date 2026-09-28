<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLguRequest extends FormRequest
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
            'municipality_name' => ['required', 'string', 'max:255'],
            'province' => ['required', 'string', 'max:255'],
            'region' => ['required', 'string', 'max:255'],
            'contact_no' => ['required', 'string', 'max:255'],
            'mayor_first_name' => ['required', 'string', 'max:255'],
            'mayor_middle_name' => ['required', 'string', 'max:255'],
            'mayor_last_name' => ['required', 'string', 'max:255'],
        ];
    }
}
