<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class MaintenanceDocumentReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.maintenance_documents';

    public const CREATED_AT = 'uploaded_at';

    /** @return BelongsTo<MaintenanceRecordReference, $this> */
    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecordReference::class, 'maintenance_id');
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'uploaded_by');
    }
}
