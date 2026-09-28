<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'username',
    'password',
    'accountType',
    'is_active',
    'engineers_id',
    'created_by',
])]
class UserAccount extends Model
{
    /** @return BelongsTo<Engineer, $this> */
    public function engineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'engineers_id');
    }

    /** @return HasMany<MaintenanceProject, $this> */
    public function maintenanceProjects(): HasMany
    {
        return $this->hasMany(MaintenanceProject::class, 'created_by');
    }

    /** @return HasMany<UserAccount, $this> */
    public function createdAccounts(): HasMany
    {
        return $this->hasMany(UserAccount::class, 'created_by');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }
}
