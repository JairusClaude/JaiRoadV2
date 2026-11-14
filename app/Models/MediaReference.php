<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class MediaReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.media';

    public const UPDATED_AT = null;

    /** @return BelongsTo<MonthlyUpdateReference, $this> */
    public function monthlyUpdate(): BelongsTo
    {
        return $this->belongsTo(MonthlyUpdateReference::class, 'monthly_update_id');
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'uploaded_by');
    }
}
