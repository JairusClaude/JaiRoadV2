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
    'created_by',

])]
class UpdatesMedia extends Model
{
    /** @return BelongsTo<MonthlyUpdate, UpdatesMedia> */
    public function monthlyUpdate(): BelongsTo
    {
        return $this->belongsTo(MonthlyUpdate::class, 'monthly_updates_id');
    }

    /** @return BelongsTo<UserAccount, UpdatesMedia> */
    public function uploadedBy(): BelongsTo // Check if this really is the parameter in the migration
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }
}
