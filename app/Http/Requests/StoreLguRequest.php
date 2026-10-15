<?php

namespace App\Http\Requests;

use App\Models\Lgu;
use Illuminate\Foundation\Http\FormRequest;

class StoreLguRequest extends FormRequest
{
    /**
     * Only users authorized by the LGU policy may create LGUs.
     */
    public function authorize(): bool
    {
        return $this->user()?->can('create', Lgu::class) ?? false;
    }

    /**
     * Get the validation rules for creating an LGU.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'municipality_name' => [
                'required',
                'string',
                'max:100',
            ],

            'province' => [
                'required',
                'string',
                'max:100',
            ],

            'region' => [
                'required',
                'string',
                'max:100',
            ],

            'mayor_first_name' => [
                'required',
                'string',
                'max:100',
            ],

            'mayor_middle_name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'mayor_last_name' => [
                'required',
                'string',
                'max:100',
            ],
        ];
    }
}
