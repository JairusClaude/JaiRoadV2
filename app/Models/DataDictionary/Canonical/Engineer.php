<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

final class Engineer extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.engineers';

    public $timestamps = false;

    /** @return HasMany<EngineerLgu, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(EngineerLgu::class, 'engineer_id');
    }

    /** @return HasOne<UserAccount, $this> */
    public function account(): HasOne
    {
        return $this->hasOne(UserAccount::class, 'engineer_id');
    }

    /** @return HasMany<RoadCoverage, $this> */
    public function createdRoadCoverages(): HasMany
    {
        return $this->hasMany(RoadCoverage::class, 'created_by');
    }

    /** @return HasMany<MaintenanceRecord, $this> */
    public function managedMaintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class, 'managing_engineer_id');
    }
}
