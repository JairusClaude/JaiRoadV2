<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'road_id',
    'project_id',
])]

class RoadNetwork extends Model
{
    public function roads()
    {
        return $this->belongsTo(Roads::class, 'road_id');
    }

    public function maintenanceProject()
    {
        return $this->belongsTo(MaintenanceProjects::class, 'project_id');
    }
}
