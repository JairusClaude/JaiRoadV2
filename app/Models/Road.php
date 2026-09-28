<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// ADD PROJECTID IN ERD
#[Fillable([
    'road_name',
    'kilometers',
    'geojsondata',
    'created_by',
    'lgu_id',
    'maintenance_project_id',
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

    /** @return BelongsTo<MaintenanceProject, Road> */
    public function maintenanceProject(): BelongsTo
    {
        return $this->belongsTo(MaintenanceProject::class, 'maintenance_project_id');
    }
}
