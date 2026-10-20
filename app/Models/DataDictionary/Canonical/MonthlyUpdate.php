<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class MonthlyUpdate extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.monthly_updates';

    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    public function media(): HasMany
    {
        return $this->hasMany(Media::class, 'monthly_update_id');
    }
}
