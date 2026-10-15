
<?php

namespace App\Http\Requests;

use App\Models\MaintenanceDocument;
use Illuminate\Foundation\Http\FormRequest;

class UpdateMaintenanceDocumentRequest extends FormRequest
{
    /**
     * Only users authorized to update this document may proceed.
     */
    public function authorize(): bool
    {
        $maintenanceDocument = $this->route('maintenanceDocument');

        return $maintenanceDocument instanceof MaintenanceDocument
            && (
                $this->user()?->can(
                    'update',
                    $maintenanceDocument
                ) ?? false
            );
    }

    /**
     * Get the validation rules for updating a maintenance document.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'document_title' => [
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'file' => [
                'sometimes',
                'nullable',
                'file',
                'mimes:pdf,docx,xlsx,pptx',
            ],
        ];
    }
}
