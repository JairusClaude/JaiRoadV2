<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class MaintenanceProject extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.maintenance_projects';

    public function roadCoverage(): BelongsTo
    {
        return $this->belongsTo(RoadCoverage::class, 'road_coverage_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class, 'project_id');
    }
}
