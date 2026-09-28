<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'municipality_name',
    'province',
    'region',
    'contact_no',
    'mayor_first_name',
    'mayor_middle_name',
    'mayor_last_name',
])]
class Lgu extends Model
{
    /** @return HasMany<Engineer, $this> */
    public function engineers(): HasMany
    {
        return $this->hasMany(Engineer::class, 'lgus_id');
    }

    /** @return HasMany<Road, $this> */
    public function roads(): HasMany
    {
        return $this->hasMany(Road::class, 'lgus_id');
    }

    /** @return HasMany<MaintenanceProject, $this> */
    public function maintenanceProjects(): HasMany
    {
        return $this->hasMany(MaintenanceProject::class, 'lgus_id');
    }
}
