<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\MonthlyUpdateFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Record-linked MonthlyUpdate. Never infer a MaintenanceRecord from a project ID. */
class MonthlyUpdate extends Model
{
    /** @use HasFactory<MonthlyUpdateFactory> */
    use HasFactory;

    protected $table = 'monthly_updates';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return ['progress_percentage' => 'decimal:2'];
    }

    /** @return BelongsTo<MaintenanceRecord, $this> */
    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'created_by');
    }

    /** @return HasMany<MonthlyUpdateMedia, $this> */
    public function media(): HasMany
    {
        return $this->hasMany(MonthlyUpdateMedia::class, 'monthly_updates_id');
    }
}
