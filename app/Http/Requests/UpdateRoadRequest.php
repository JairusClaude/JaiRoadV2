<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateRoadRequest extends FormRequest
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
            'road_name' => ['required', 'string', 'max:255'],
            'kilometers' => ['required', 'integer', 'min:0'],
            'geojsondata' => ['required', 'string', 'max:255'],
            'created_by' => ['required', 'integer', 'exists:user_accounts,id'],
            'lgus_id' => ['required', 'integer', 'exists:lgus,id'],
            'road_id' => ['required', 'integer', 'exists:roads,id'],
        ];
    }
}
