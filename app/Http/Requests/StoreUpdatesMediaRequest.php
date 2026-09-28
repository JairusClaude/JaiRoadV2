<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreUpdatesMediaRequest extends FormRequest
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
            'file_name' => ['required', 'string', 'max:255'],
            'file_path' => ['required', 'string', 'max:255'],
            'file_type' => ['required', 'string', 'max:255'],
            'monthly_updates_id' => ['required', 'integer', 'exists:monthly_updates,id'],
        ];
    }
}
