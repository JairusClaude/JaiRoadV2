<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'username',
    'password',
    'role',
    'is_active',
    'engineer_id',
    'created_by', // creator_id
])]
class UserAccount extends Model
{
    /** @return BelongsTo<Engineer, UserAccount> */
    public function engineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'engineer_id');
    }

    /** @return HasMany<MaintenanceProject, UserAccount> */
    public function maintenanceProjects(): HasMany
    {
        return $this->hasMany(MaintenanceProject::class);
    }

    /** @return HasMany<UserAccount, UserAccount> */
    public function createdAccounts(): HasMany // This creates account
    {
        return $this->hasMany(UserAccount::class, 'created_by');
    }

    /** @return BelongsTo<UserAccount, UserAccount> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }
}