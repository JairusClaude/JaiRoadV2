<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Junction has a composite PK (engineer_id, lgu_id). Eloquent has no native composite-key writes. READ ONLY. */
final class EngineerLguReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.engineer_lgus';

    protected $primaryKey = null;

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsTo<EngineerReference, $this> */
    public function engineer(): BelongsTo
    {
        return $this->belongsTo(EngineerReference::class, 'engineer_id');
    }

    /** @return BelongsTo<LguReference, $this> */
    public function lgu(): BelongsTo
    {
        return $this->belongsTo(LguReference::class, 'lgu_id');
    }
}
