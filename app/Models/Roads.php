<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'road_name',
    'kilometers',
    'geojsondata',
    'created_by',
    'lgu_id',
])]

class Roads extends Model
{
    public function userAccount(){
    return $this->belongsTo(UserAccounts::class, 'created_by');
}

    public function lgu(){
    return $this->belongsTo(Lgu::class, 'lgu_id');
}
}
