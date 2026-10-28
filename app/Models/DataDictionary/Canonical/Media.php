<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Media extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.media';

    public const UPDATED_AT = null;

    /** @return BelongsTo<MonthlyUpdate, $this> */
    public function monthlyUpdate(): BelongsTo
    {
        return $this->belongsTo(MonthlyUpdate::class, 'monthly_update_id');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'uploaded_by');
    }
}
