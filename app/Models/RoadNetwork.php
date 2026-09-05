<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


#[Fillable([
    'road_id',
    'maintenance_project_id',
])]

class RoadNetwork extends Model  //What is the point of RoadNetwork given that geojson data does it already
{
    public function roads(): HasMany //why bellongsTo
    {
        return $this->hasMany(Road::class, 'road_id');
    }

    public function maintenanceProject(): BelongsTo   //Need reconfirmation
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
