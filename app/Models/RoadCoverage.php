<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['road_name', 'lgus_id', 'kilometers', 'pavement_type', 'state_category', 'geojson', 'created_by'])]
class RoadCoverage extends Model
{
    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['geojson' => 'array', 'kilometers' => 'decimal:2'];
    }

    /** @return BelongsTo<Lgu, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgus_id');
    }

    /** @return BelongsTo<Engineer, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'created_by');
    }

    /** @return HasOne<MaintenanceProject, $this> */
    public function maintenanceProject(): HasOne
    {
        return $this->hasOne(MaintenanceProject::class, 'road_coverage_id');
    }
}
