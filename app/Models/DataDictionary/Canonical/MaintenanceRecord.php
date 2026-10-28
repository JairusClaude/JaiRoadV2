<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class MaintenanceRecord extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.maintenance_records';

    protected function casts(): array
    {
        return [
            'maintenance_year' => 'integer',
            'start_date' => 'date:Y-m-d',
            'estimated_duration_days' => 'integer',
            'complete_date' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<MaintenanceProject, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(MaintenanceProject::class, 'project_id');
    }

    /** @return BelongsTo<Engineer, $this> */
    public function managingEngineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'managing_engineer_id');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    /** @return HasMany<MonthlyUpdate, $this> */
    public function monthlyUpdates(): HasMany
    {
        return $this->hasMany(MonthlyUpdate::class, 'maintenance_id');
    }

    /** @return HasMany<MaintenanceDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(MaintenanceDocument::class, 'maintenance_id');
    }
}
