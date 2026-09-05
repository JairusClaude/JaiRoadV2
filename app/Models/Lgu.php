<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


#[Fillable([
    'municipality_name',
    'province',
    'region',
    'contact_no',
    'mayor_first_name',
    'mayor_middle_name',
    'mayor_last_name',
    'created_by',
])]  //NOTE ERD SHOULD HAVE A POINTER FROM LGU TO ENGINEER

class Lgu extends Model
{
    public function createdBy(): BelongsTo
        {
            return $this->belongsTo(UserAccount::class, 'created_by');
        }
    public function engineers(): HasMany
        {
            return $this->hasMany(Engineer::class, 'lgu_id');  //[NEED RECONFIRMATION: NOT IN ERD]
        }
    public function roads(): HasMany
        {
            return $this->hasMany(Road::class, 'lgu_id');
        }
    public function maintenanceProjects(): HasMany
        {
            return $this->hasMany(MaintenanceProject::class, 'lgu_id');
        }
}


