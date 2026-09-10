<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'road_id',
    'maintenance_project_id',
])]

class RoadNetwork extends Model  // What is the point of RoadNetwork given that geojson data does it already
{
    /** @return HasMany<Road, RoadNetwork> */
    public function roads(): HasMany // why bellongsTo
    {
        return $this->hasMany(Road::class, 'road_id');
    }

    /** @return BelongsTo<MaintenanceProject, RoadNetwork> */
    public function maintenanceProject(): BelongsTo   // Need reconfirmation
    {
        return $this->belongsTo(MaintenanceProject::class, 'maintenance_project_id');
    }

    // public function maintenanceProjects(): BelongsToMany  //THE HELL IS THIS
    // {
    //     return $this->belongsToMany(
    //         MaintenanceProjects::class,
    //         'road_networks',
    //         'road_id',
    //         'maintenance_project_id'
    //     );
    // }
}
