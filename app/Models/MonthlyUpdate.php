<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'maintenance_project_id',
    'update_month',
    'progress_percentage',
    'summary_of_text_reports',
    'created_by',
])]

class MonthlyUpdate extends Model
{
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    public function maintenanceProject(): BelongsTo
    {
        return $this->belongsTo(MaintenanceProject::class, 'maintenance_projects_id');
    }

    public function updatesMedia(): HasMany
    {
        return $this->hasMany(UpdatesMedia::class);
    }
}
