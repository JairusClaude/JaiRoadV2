<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'first_name',
    'middle_name',
    'last_name',
    'email',
    'contact_no',
    'rank',
    'position',
    'lgu_id',
    'created_by',
])]

class Engineer extends Model{
    public function lgu(){
        return $this->belongsTo(Lgu::class, 'lgu_id');
}

    public function userAccount(){
        return $this->belongsTo(UserAccounts::class, 'created_by');
}
}
