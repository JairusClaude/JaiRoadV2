<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'document_title',
    'project_id',
    'description',
    'file_name',
    'file_path',
    'uploaded_by',
])]
class ProjectDocuments extends Model
{
        public function userAccount(){
    return $this->belongsTo(UserAccounts::class, 'uploaded_by');
}

    public function maintenanceProject(){
    return $this->belongsTo(MaintenanceProjects::class, 'maintenance_project_id',);
}

}
