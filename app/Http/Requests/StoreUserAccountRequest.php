<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserAccountRequest extends FormRequest
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
            'username' => ['required', 'string', 'max:255', Rule::unique('user_accounts', 'username')],
            'password' => ['required', 'string', 'min:8'],
            'accountType' => ['required', 'string', 'in:viewer,user,admin'],
            'is_active' => ['required', 'boolean'],
            'engineers_id' => ['nullable', 'integer', 'exists:engineers,id', Rule::unique('user_accounts', 'engineers_id')],
            'created_by' => ['nullable', 'integer', 'exists:user_accounts,id'],
        ];
    }
}
