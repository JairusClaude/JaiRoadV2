<?php

namespace App\Http\Requests;

use App\Models\Media;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMediaRequest extends FormRequest
{
    /**
     * Only users authorized to update this Media record may proceed.
     */
    public function authorize(): bool
    {
        $media = $this->route('media');

        return $media instanceof Media
            && (
                $this->user()?->can('update', $media) ?? false
            );
    }

    /**
     * Get the validation rules for replacing a Media file.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm',
            ],
        ];
    }
}
