<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class RoadCoverage extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.road_coverages';

    protected function casts(): array
    {
        return [
            'geojson' => 'array',
        ];
    }

    /** @return BelongsTo<Lgu, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }

    /** @return BelongsTo<Engineer, $this> */
    public function creatorEngineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'created_by');
    }

    /** @return HasOne<MaintenanceProject, $this> */
    public function project(): HasOne
    {
        return $this->hasOne(MaintenanceProject::class, 'road_coverage_id');
    }
}
