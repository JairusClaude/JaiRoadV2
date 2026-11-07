<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class EngineerReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.engineers';

    public $timestamps = false;

    /** @return HasMany<EngineerLguReference, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(EngineerLguReference::class, 'engineer_id');
    }

    /** @return HasOne<UserAccountReference, $this> */
    public function account(): HasOne
    {
        return $this->hasOne(UserAccountReference::class, 'engineer_id');
    }

    /** @return HasMany<RoadCoverageReference, $this> */
    public function createdRoadCoverages(): HasMany
    {
        return $this->hasMany(RoadCoverageReference::class, 'created_by');
    }

    /** @return HasMany<MaintenanceRecordReference, $this> */
    public function managedMaintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecordReference::class, 'managing_engineer_id');
    }
}
