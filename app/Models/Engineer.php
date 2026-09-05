<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


#[Fillable([
    'first_name',
    'middle_name',
    'last_name',
    'email',
    'contact_no',
    'rank',
    'position',
    'lgu_id',  //[NEED RECONFIRMATION: NOT IN ERD]
    'created_by',
])]

class Engineer extends Model
{
    public function lgu(): BelongsTo{
        return $this->belongsTo(Lgu::class, 'lgu_id');  //[NEED RECONFIRMATION: NOT IN ERD]
    }
    public function userAccount(): BelongsTo{
        return $this->belongsTo(UserAccount::class, 'engineer_id'); 
    }
    public function createdBy(): BelongsTo{
        return $this->belongsTo(UserAccount::class, 'created_by');
    }
    public function maintenanceProjects(): HasMany{
        return $this->hasMany(maintenanceProject::class);
    }
}
