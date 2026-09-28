<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'road_name',
    'kilometers',
    'geojsondata',
    'created_by',
    'lgus_id',
    'road_id',
])]
class Road extends Model
{
    /** @return BelongsTo<UserAccount, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            UserAccount::class,
            'created_by'
        );
    }

    /** @return BelongsTo<Lgu, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgus_id');
    }

    /** @return BelongsTo<Road, $this> */
    public function parentRoad(): BelongsTo
    {
        return $this->belongsTo(
            Road::class,
            'road_id'
        );
    }

    /** @return HasMany<Road, $this> */
    public function childRoads(): HasMany
    {
        return $this->hasMany(
            Road::class,
            'road_id'
        );
    }
}
