<?php

namespace App\Http\Requests;

use App\Models\Engineer;
use App\Models\UserAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserAccountRequest extends FormRequest
{
    /**
     * Only authorized account managers may create user accounts.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            UserAccount::class
        ) ?? false;
    }

    /**
     * Get the validation rules for creating a user account.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $engineer = new Engineer;
        $account = new UserAccount;

        return [
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique($account->getTable(), 'username'),
            ],

            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique($account->getTable(), 'email'),
            ],

            'password' => [
                'required',
                'string',
                'min:8',
                'max:255',
            ],

            'accountType' => [
                'required',
                'string',
                Rule::in([
                    'SuperAdmin',
                    'Admin',
                    'Engineer',
                    'Viewer',
                ]),
            ],

            'engineer_id' => [
                Rule::requiredIf(
                    fn () => in_array(
                        $this->input('accountType'),
                        ['Admin', 'Engineer'],
                        true
                    )
                ),

                Rule::prohibitedIf(
                    fn () => in_array(
                        $this->input('accountType'),
                        ['SuperAdmin', 'Viewer'],
                        true
                    )
                ),

                'nullable',
                'integer',

                Rule::exists(
                    $engineer->getTable(),
                    $engineer->getKeyName()
                ),

                Rule::unique(
                    $account->getTable(),
                    'engineer_id'
                ),
            ],
        ];
    }
}
