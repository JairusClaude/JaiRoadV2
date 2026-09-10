<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'document_title',
    'maintenance_project_id',
    'description',
    'file_name',
    'file_path',
    'uploaded_by',
])]
class ProjectDocument extends Model
{
    /** @return BelongsTo<UserAccount, ProjectDocument> */
    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'uploaded_by');
    }

    /** @return BelongsTo<MaintenanceProject, ProjectDocument> */
    public function maintenanceProject(): BelongsTo
    {
        return $this->belongsTo(MaintenanceProject::class, 'maintenance_project_id');
    }
}
