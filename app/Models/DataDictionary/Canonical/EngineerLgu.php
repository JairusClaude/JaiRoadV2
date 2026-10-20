<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Junction has a composite PK (engineer_id, lgu_id). Eloquent has no native composite-key writes. READ ONLY. */
final class EngineerLgu extends ReadOnlyDdModel
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

    public function engineer(): BelongsTo
    {
        return $this->belongsTo(Engineer::class, 'engineer_id');
    }

    public function lgu(): BelongsTo
    {
        return $this->belongsTo(Lgu::class, 'lgu_id');
    }
}
