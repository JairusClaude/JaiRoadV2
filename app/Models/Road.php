<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'road_name',
    'kilometers',
    'geojsondata',
    'created_by',
    'lgu_id',
    'maintenance_project_id',
])] // ADD PROJECTID IN ERD

class Road extends Model
{
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }

    public function roadNetwork(): HasOne  // NEED CONFIRMATION IF CORRECT SYNTAX AS WELL AS ELOQUENCT
    {
        return $this->HasOne(RoadNetwork::class);
    }

    public function maintenanceProjects(): BelongsTo // need confirmation if correct
    {
        return $this->belongsTo(MaintenanceProject::class, 'maintenance_project_id');
    }
}
