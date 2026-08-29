<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'municipality_name',
    'province',
    'region',
    'contact_no',
    'mayor_first_name',
    'mayor_middle_name',
    'mayor_last_name',
    'created_by',
])]

class Lgu extends Model
{
    public function userAccount()
    {
        return $this->belongsTo(UserAccounts::class, 'created_by');
    }
}
