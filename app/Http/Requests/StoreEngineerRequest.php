
<?php

namespace App\Http\Requests;

use App\Models\Engineer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEngineerRequest extends FormRequest
{
    /**
     * Only users authorized by the Engineer policy may create engineers.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Engineer::class) ?? false;
    }

    /**
     * Get the validation rules for creating an engineer.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'first_name' => [
                'required',
                'string',
                'max:100',
            ],

            'middle_name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'last_name' => [
                'required',
                'string',
                'max:100',
            ],

            'contact_no' => [
                'required',
                'string',
                'max:30',
            ],

            'rank' => [
                'required',
                'string',
                'max:100',
            ],

            'engineer_status' => [
                'sometimes',
                'required',
                'string',
                'max:20',
                Rule::in(['Active', 'Retired']),
            ],
        ];
    }
}

