<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

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

class MaintenanceProject extends Model
{
    /** @return BelongsTo<Lgu, MaintenanceProject> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }

    /** @return BelongsTo<Engineer, MaintenanceProject> */
    public function managingEngineerID(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'engineer_id');
    }

    /** @return BelongsTo<UserAccount, MaintenanceProject> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    /** @return HasMany<Road, MaintenancePoject> */
    public function roads(): HasMany
    {
        return $this->hasMany(Road::class);
    }

    /** @return HasMany<ProjectDocument, MaintenanceProject> */
    public function projectDocuments(): HasMany
    {
        return $this->hasMany(ProjectDocument::class, 'maintenance_project_id');
    }

    /** @return HasMany<MonthlyUpdate, MaintenanceProject> */
    public function monthlyUpdates(): HasMany
    {
        return $this->hasMany(MonthlyUpdate::class, 'maintenance_project_id');
    }

    /** @return HasOne<RoadNetwork, MaintenanceProject> */
    public function roadNetwork(): HasOne
    {
        return $this->hasOne(RoadNetwork::class, 'maintenance_project_id');
    }
}
