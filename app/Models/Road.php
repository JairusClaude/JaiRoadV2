<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

// ADD PROJECTID IN ERD
#[Fillable([
    'road_name',
    'kilometers',
    'geojsondata',
    'created_by',
    'lgu_id',
    'maintenance_project_id'
])]
class Road extends Model
{
    /** @return BelongsTo<UserAccount, Road> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    /** @return BelongsTo<Lgu, Road> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }

    /** @return HasOne<RoadNetwork, Road> */
    public function roadNetwork(): HasOne  // NEED CONFIRMATION IF CORRECT SYNTAX AS WELL AS ELOQUENCT
    {
        return $this->hasOne(RoadNetwork::class);
    }

    /** @return BelongsTo<MaintenanceProject, Road> */
    public function maintenanceProject(): BelongsTo // need confirmation if correct
    {
        return $this->belongsTo(MaintenanceProject::class, 'maintenance_project_id');
    }
}