<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Scoped MonthlyUpdate evidence model; no public file URL or mass assignment. */
class MonthlyUpdateMedia extends Model
{
    protected $table = 'media';
    protected $guarded = ['*'];

    public function monthlyUpdate(): BelongsTo
    {
        return $this->belongsTo(MonthlyUpdate::class, 'monthly_updates_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'uploaded_by');
    }
}
