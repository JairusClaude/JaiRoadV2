<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class MaintenanceProjectReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.maintenance_projects';

    /** @return BelongsTo<RoadCoverageReference, $this> */
    public function roadCoverage(): BelongsTo
    {
        return $this->belongsTo(RoadCoverageReference::class, 'road_coverage_id');
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'created_by');
    }

    /** @return HasMany<MaintenanceRecordReference, $this> */
    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecordReference::class, 'project_id');
    }
}
