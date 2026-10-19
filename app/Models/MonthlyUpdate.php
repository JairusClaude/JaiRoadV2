<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Record-linked MonthlyUpdate. Never infer a MaintenanceRecord from a project ID. */
class MonthlyUpdate extends Model
{
    protected $table = 'monthly_updates';
    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['progress_percentage' => 'decimal:2'];
    }

    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    public function media(): HasMany
    {
        return $this->hasMany(MonthlyUpdateMedia::class, 'monthly_updates_id');
    }
}
