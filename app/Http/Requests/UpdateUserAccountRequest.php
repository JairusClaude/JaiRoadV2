
<?php

namespace App\Http\Requests;

use App\Models\Engineer;
use App\Models\UserAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserAccountRequest extends FormRequest
{
    /**
     * Only authorized account managers may update user accounts.
     */
    public function authorize(): bool
    {
        $userAccount = $this->route('user_account')
            ?? $this->route('userAccount');

        return $userAccount instanceof UserAccount
            && (
                $this->user()?->can('update', $userAccount)
                ?? false
            );
    }

    /**
     * Get the validation rules for updating a user account.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userAccount = $this->route('user_account')
            ?? $this->route('userAccount');

        if (! $userAccount instanceof UserAccount) {
            return [];
        }

        $account = new UserAccount();
        $engineer = new Engineer();

        return [
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique(
                    $account->getTable(),
                    'username'
                )->ignore(
                    $userAccount->getKey(),
                    $userAccount->getKeyName()
                ),
            ],

            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(
                    $account->getTable(),
                    'email'
                )->ignore(
                    $userAccount->getKey(),
                    $userAccount->getKeyName()
                ),
            ],

            'password' => [
                'nullable',
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
                )->ignore(
                    $userAccount->getKey(),
                    $userAccount->getKeyName()
                ),
            ],

            'is_active' => [
                'required',
                'boolean',
            ],
        ];
    }
}
