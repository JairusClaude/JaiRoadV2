<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'project_title',
    'description',
    'status',
    'start_date',
    'end_date',
    'gravelled_road_in_km',
    'lgu_id',
    'engineer_id',
    'created_by',
])]

class MaintenanceProjects extends Model
{
    public function lgu(){
    return $this->belongsTo(Lgu::class, 'lgu_id');
}

public function engineer(){
    return $this->belongsTo(Engineer::class, 'engineer_id');
}

public function userAccount(){
    return $this->belongsTo(UserAccounts::class, 'created_by');
}
}
