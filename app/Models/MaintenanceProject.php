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
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }

    public function managingEngineerID(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'engineer_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    public function roads(): HasMany
    {
        return $this->hasMany(Road::class);
    }

    public function projectDocuments(): HasMany
    {
        return $this->hasMany(Road::class, 'maintenance_project_id');
    }

    public function monthlyUpdates(): HasMany
    {
        return $this->hasMany(MonthlyUpdate::class, 'maintenance_project_id');
    }

    public function roadNetwork(): HasOne
    {
        return $this->hasOne(RoadNetwork::class);
    }
}
