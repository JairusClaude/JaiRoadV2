<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'project_title',
    'description',
    'status',
    'start_date',
    'end_date',
    'gravelled_road_in_km',
    'lgus_id',
    'engineers_id',
    'created_by',
])]
class MaintenanceProject extends Model
{

    use HasFactory;
    /** @return BelongsTo<Lgu, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgus_id');
    }

    /** @return BelongsTo<Engineer, $this> */
    public function managingEngineerID(): BelongsTo
    {
        return $this->belongsTo(
            Engineer::class,
            'engineers_id'
        );
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            UserAccount::class,
            'created_by'
        );
    }

    /** @return HasMany<ProjectDocument, $this> */
    public function projectDocuments(): HasMany
    {
        return $this->hasMany(
            ProjectDocument::class,
            'maintenance_projects_id'
        );
    }

    /** @return HasMany<MonthlyUpdate, $this> */
    public function monthlyUpdates(): HasMany
    {
        return $this->hasMany(
            MonthlyUpdate::class,
            'maintenance_projects_id'
        );
    }
}
