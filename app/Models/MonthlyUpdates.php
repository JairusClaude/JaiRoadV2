<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'maintenance_project_id',
    'update_month',
    'progress_percentage',
    'summary_of_text_reports',
    'created_by',
])]

class MonthlyUpdates extends Model
{
    public function userAccount(){
    return $this->belongsTo(UserAccounts::class, 'created_by');
}

    public function maintenanceProject(){
    return $this->belongsTo(MaintenanceProjects::class, 'maintenance_project_id');
}
}
