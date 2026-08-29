<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'monthly_updates_id',
    'file_name',
    'file_path',
    'file_type',
    'created_by',
    
])]
class UpdatesMedia extends Model
{
    public function monthlyUpdate(){
    return $this->belongsTo(MonthlyUpdates::class, 'monthly_updates_id');
}
    public function userAccount(){
    return $this->belongsTo(UserAccounts::class, 'created_by');
}
}
