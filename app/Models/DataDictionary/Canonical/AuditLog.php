<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AuditLog extends ReadOnlyDdModel
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

    /** @return BelongsTo<UserAccount, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'user_id');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function recipient(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'recipient_user_id');
    }
}
