<?php

namespace App\Models;

use Database\Factories\MaintenanceRecordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'maintenance_projects_id',
    'engineers_id',
    'maintenance_year',
    'quarter',
    'start_date',
    'estimated_duration_days',
    'complete_date',
    'status',
    'description',
    'created_by',
])]
class MaintenanceRecord extends Model
{
    /** @use HasFactory<MaintenanceRecordFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'maintenance_year' => 'integer',
            'estimated_duration_days' => 'integer',
            'start_date' => 'date:Y-m-d',
            'complete_date' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<MaintenanceProject, $this> */
    public function maintenanceProject(): BelongsTo
    {
        return $this->belongsTo(
            MaintenanceProject::class,
            'maintenance_projects_id'
        );
    }

    /** @return BelongsTo<Engineer, $this> */
    public function managingEngineer(): BelongsTo
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
}

