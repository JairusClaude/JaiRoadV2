<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

// REMEMBER TO USE "git checkout -b my-feature" instead of commiting to main
#[Fillable([
    'first_name',
    'middle_name',
    'last_name',
    'email',
    'contact_no',
    'rank',
    'position',
    'lgu_id', // NEED CONFIRMATION NOT IN ERD
    'created_by',
])]
class Engineer extends Model
{
    /** @return BelongsTo<Lgu, Engineer> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }

    /** @return HasOne<UserAccount, Engineer> */ // Changed from BelongsTo
    public function userAccount(): HasOne
    {
        return $this->hasOne(UserAccount::class, 'engineer_id');
    }

    /** @return BelongsTo<UserAccount, Engineer> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    /** @return HasMany<MaintenanceProject, Engineer> */
    public function maintenanceProjects(): HasMany
    {
        return $this->hasMany(MaintenanceProject::class);
    }
}
