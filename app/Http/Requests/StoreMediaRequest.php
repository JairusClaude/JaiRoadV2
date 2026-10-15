
<?php

namespace App\Http\Requests;

use App\Models\Media;
use App\Models\MonthlyUpdate;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMediaRequest extends FormRequest
{
    /**
     * Only users authorized by the Media policy may upload evidence.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            Media::class
        ) ?? false;
    }

    /**
     * Get the validation rules for uploading Media.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $monthlyUpdate = new MonthlyUpdate;

        return [
            'monthly_update_id' => [
                'required',
                'integer',
                Rule::exists(
                    $monthlyUpdate->getTable(),
                    $monthlyUpdate->getKeyName()
                ),
            ],

            'file' => [
                'required',
                'file',
                'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm',
            ],
        ];
    }
}
