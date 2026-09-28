<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreProjectDocumentRequest extends FormRequest
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
            'document_title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'file_name' => ['required', 'string', 'max:255'],
            'file_path' => ['required', 'string', 'max:255'],
            'maintenance_projects_id' => ['required', 'integer', 'exists:maintenance_projects,id'],
            'uploaded_by' => ['required', 'integer', 'exists:user_accounts,id'],
        ];
    }
}
