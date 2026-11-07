<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

final class LguReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.lgus';

    public $timestamps = false;

    /** @return HasMany<RoadCoverageReference, $this> */
    public function roadCoverages(): HasMany
    {
        return $this->hasMany(RoadCoverageReference::class, 'lgu_id');
    }

    /** @return HasMany<EngineerLguReference, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(EngineerLguReference::class, 'lgu_id');
    }
}
