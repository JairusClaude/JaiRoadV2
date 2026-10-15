<?php

namespace App\Http\Requests;

use App\Models\MaintenanceDocument;
use App\Models\MaintenanceRecord;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMaintenanceDocumentRequest extends FormRequest
{
    /**
     * Only users authorized by the MaintenanceDocument policy
     * may upload maintenance documents.
     */
    public function authorize(): bool
    {
        return $this->user()?->can(
            'create',
            MaintenanceDocument::class
        ) ?? false;
    }

    /**
     * Get the validation rules for uploading a maintenance document.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $maintenanceRecord = new MaintenanceRecord();

        return [
            'maintenance_id' => [
                'required',
                'integer',
                Rule::exists(
                    $maintenanceRecord->getTable(),
                    $maintenanceRecord->getKeyName()
                ),
            ],

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
                'required',
                'file',
                'mimes:pdf,docx,xlsx,pptx',
            ],
        ];
    }
}
