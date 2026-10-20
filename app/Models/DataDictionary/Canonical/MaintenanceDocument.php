<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class MaintenanceDocument extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.maintenance_documents';
    public const CREATED_AT = 'uploaded_at';

    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'uploaded_by');
    }
}
