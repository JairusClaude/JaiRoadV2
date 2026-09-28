<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'monthly_updates_id',
    'file_name',
    'file_path',
    'file_type',
])]
class UpdatesMedia extends Model
{
    /** @return BelongsTo<MonthlyUpdate, $this> */
    public function monthlyUpdate(): BelongsTo
    {
        return $this->belongsTo(
            MonthlyUpdate::class,
            'monthly_updates_id'
        );
    }
}
