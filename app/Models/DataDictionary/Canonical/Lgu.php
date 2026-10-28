<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\HasMany;

final class Lgu extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.lgus';

    public $timestamps = false;

    /** @return HasMany<RoadCoverage, $this> */
    public function roadCoverages(): HasMany
    {
        return $this->hasMany(RoadCoverage::class, 'lgu_id');
    }

    /** @return HasMany<EngineerLgu, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(EngineerLgu::class, 'lgu_id');
    }
}
