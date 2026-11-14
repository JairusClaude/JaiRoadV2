<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AuditLogReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.audit_logs';

    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'old_value' => 'array',
            'new_value' => 'array',
        ];
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'user_id');
    }

    /** @return BelongsTo<UserAccountReference, $this> */
    public function recipient(): BelongsTo
    {
        return $this->belongsTo(UserAccountReference::class, 'recipient_user_id');
    }
}
