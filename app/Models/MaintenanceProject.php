<?php

namespace App\Models;

use Database\Factories\MaintenanceProjectFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Facades\Schema;

#[Fillable([
    'project_title',
    'road_coverage_id',
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
    /** @use HasFactory<MaintenanceProjectFactory> */
    use HasFactory;

    /** @return BelongsTo<RoadCoverage, $this> */
    public function roadCoverage(): BelongsTo
    {
        return $this->belongsTo(RoadCoverage::class);
    }

    /** @return HasMany<MaintenanceRecord, $this> */
    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class, 'maintenance_projects_id');
    }

    // Legacy relations remain for existing modules; directory municipality is
    // derived exclusively through roadCoverage.lgu, never through this old FK.
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

    /** Compatibility during staged cutover; never reinterpret legacy rows as record history. */
    public function monthlyUpdates(): HasMany|HasManyThrough
    {
        // ProjectMutations::delete calls this method even before SQL cutover.
        // Keep the old FK functional during staging, then traverse records after cutover.
        if (! Schema::hasColumn('monthly_updates', 'maintenance_id')) {
            return $this->hasMany(MonthlyUpdate::class, 'maintenance_projects_id');
        }
        return $this->hasManyThrough(
            MonthlyUpdate::class, MaintenanceRecord::class,
            'maintenance_projects_id', 'maintenance_id', 'id', 'id'
        );
    }
}
