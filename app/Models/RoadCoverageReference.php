<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class RoadCoverageReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.road_coverages';

    protected function casts(): array
    {
        return [
            'geojson' => 'array',
        ];
    }

    /** @return BelongsTo<LguReference, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(LguReference::class, 'lgu_id');
    }

    /** @return BelongsTo<EngineerReference, $this> */
    public function creatorEngineer(): BelongsTo
    {
        return $this->belongsTo(EngineerReference::class, 'created_by');
    }

    /** @return HasOne<MaintenanceProjectReference, $this> */
    public function project(): HasOne
    {
        return $this->hasOne(MaintenanceProjectReference::class, 'road_coverage_id');
    }
}
