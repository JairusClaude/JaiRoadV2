<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'maintenance_projects_id',
    'update_month',
    'progress_percentage',
    'summary_of_text_reports',
    'created_by',
])]
class MonthlyUpdate extends Model
{
    /** @return BelongsTo<UserAccount, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    /** @return BelongsTo<MaintenanceProject, $this> */
    public function maintenanceProject(): BelongsTo
    {
        return $this->belongsTo(
            MaintenanceProject::class,
            'maintenance_projects_id'
        );
    }

    /** @return HasMany<UpdatesMedia, $this> */
    public function updatesMedia(): HasMany
    {
        return $this->hasMany(
            UpdatesMedia::class,
            'monthly_updates_id'
        );
    }
}
