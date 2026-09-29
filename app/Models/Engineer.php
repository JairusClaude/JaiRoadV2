<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'first_name',
    'middle_name',
    'last_name',
    'email',
    'contact_no',
    'rank',
    'position',
    'lgus_id',
])]
class Engineer extends Model
{

    use HasFactory;
    /** @return BelongsTo<Lgu, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgus_id');
    }

    /** @return HasOne<UserAccount, $this> */
    public function userAccount(): HasOne
    {
        return $this->hasOne(UserAccount::class, 'engineers_id');
    }

    /** @return HasMany<MaintenanceProject, $this> */
    public function maintenanceProjects(): HasMany
    {
        return $this->hasMany(
            MaintenanceProject::class,
            'engineers_id'
        );
    }
}
