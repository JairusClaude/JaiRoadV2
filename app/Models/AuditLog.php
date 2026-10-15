<?php

namespace App\Models;

use Database\Factories\AuditLogFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'actor_identifier',
    'action',
    'entity_type',
    'entity_id',
    'description',
    'old_value',
    'new_value',
    'notification_message',
    'user_id',
    'recipient_user_id',
])]
class AuditLog extends Model
{
    /** @use HasFactory<AuditLogFactory> */
    use HasFactory;

    /**
     * Cast JSON attributes to array/object automatically
     */
    protected function casts(): array
    {
        return [
            'old_value' => 'array',
            'new_value' => 'array',
        ];
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'user_id');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function recipientUser(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'recipient_user_id');
    }
}
