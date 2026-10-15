
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAuditLogRequest extends FormRequest
{
    /**
     * Prevent manual creation of audit log records.
     */
    public function authorize(): bool
    {
        return false;
    }

    /**
     * No validation rules are required because
     * manual audit log creation is not permitted.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
