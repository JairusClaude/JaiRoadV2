<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class MaintenanceRecordReference extends ReadOnlyReferenceModel
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

    /** @return BelongsTo<MaintenanceProjectReference, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(MaintenanceProjectReference::class, 'project_id');
    }

    /** @return BelongsTo<EngineerReference, $this> */
    public function managingEngineer(): BelongsTo
    {
        return $this->belongsTo(EngineerReference::class, 'managing_engineer_id');
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'created_by');
    }

    /** @return HasMany<MonthlyUpdateReference, $this> */
    public function monthlyUpdates(): HasMany
    {
        return $this->hasMany(MonthlyUpdateReference::class, 'maintenance_id');
    }

    /** @return HasMany<MaintenanceDocumentReference, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(MaintenanceDocumentReference::class, 'maintenance_id');
    }
}
