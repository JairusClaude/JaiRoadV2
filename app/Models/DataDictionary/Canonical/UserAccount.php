<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class UserAccount extends ReadOnlyDdModel
{
    protected $table = 'jairoads_next.user_accounts';
    protected $hidden = ['password'];

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

    public function createdProjects(): HasMany
    {
        return $this->hasMany(MaintenanceProject::class, 'created_by');
    }

    public function createdMaintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class, 'created_by');
    }

    public function createdMonthlyUpdates(): HasMany
    {
        return $this->hasMany(MonthlyUpdate::class, 'created_by');
    }

    public function uploadedDocuments(): HasMany
    {
        return $this->hasMany(MaintenanceDocument::class, 'uploaded_by');
    }

    public function uploadedMedia(): HasMany
    {
        return $this->hasMany(Media::class, 'uploaded_by');
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'recipient_user_id');
    }
}
