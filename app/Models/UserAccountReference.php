<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class UserAccountReference extends ReadOnlyReferenceModel
{
    protected $table = 'jairoads_next.user_accounts';

    protected $hidden = ['password'];

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

    /** @return HasMany<MaintenanceProjectReference, $this> */
    public function createdProjects(): HasMany
    {
        return $this->hasMany(MaintenanceProjectReference::class, 'created_by');
    }

    /** @return HasMany<MaintenanceRecordReference, $this> */
    public function createdMaintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecordReference::class, 'created_by');
    }

    /** @return HasMany<MonthlyUpdateReference, $this> */
    public function createdMonthlyUpdates(): HasMany
    {
        return $this->hasMany(MonthlyUpdateReference::class, 'created_by');
    }

    /** @return HasMany<MaintenanceDocumentReference, $this> */
    public function uploadedDocuments(): HasMany
    {
        return $this->hasMany(MaintenanceDocumentReference::class, 'uploaded_by');
    }

    /** @return HasMany<MediaReference, $this> */
    public function uploadedMedia(): HasMany
    {
        return $this->hasMany(MediaReference::class, 'uploaded_by');
    }

    /** @return HasMany<AuditLogReference, $this> */
    public function auditEvents(): HasMany
    {
        return $this->hasMany(AuditLogReference::class, 'user_id');
    }

    /** @return HasMany<AuditLogReference, $this> */
    public function notifications(): HasMany
    {
        return $this->hasMany(AuditLogReference::class, 'recipient_user_id');
    }
}
