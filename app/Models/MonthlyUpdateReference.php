<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class MonthlyUpdateReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.monthly_updates';

    /** @return BelongsTo<MaintenanceRecordReference, $this> */
    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecordReference::class, 'maintenance_id');
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'created_by');
    }

    /** @return HasMany<MediaReference, $this> */
    public function media(): HasMany
    {
        return $this->hasMany(MediaReference::class, 'monthly_update_id');
    }
}
