
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAuditLogRequest extends FormRequest
{
    /**
     * Prevent manual modification of audit log records.
     */
    public function authorize(): bool
    {
        return false;
    }

    /**
     * No validation rules are required because
     * manual audit log updates are prohibited.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
