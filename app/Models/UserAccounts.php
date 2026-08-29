<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'username',
    'password',
    'role',
    'is_active',
    'engineer_id',
])]
class UserAccounts extends Model
{
    public function engineer(){
    return $this->belongsTo(Engineer::class, 'engineer_id');
}
}
