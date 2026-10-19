<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Intended MaintenanceDocument entity (data dictionary).
 * Database migration is NOT included: verify the real table first.
 *
 * @property int $id
 * @property int $maintenance_id
 * @property string $document_title
 * @property string|null $description
 * @property string $file_name
 * @property string $file_path
 * @property int $uploaded_by
 */
class MaintenanceDocument extends Model
{
    protected $table = 'maintenance_documents';

    // Fail closed until the team's schema/storage/authorization is approved.
    protected $guarded = ['*'];

    public const CREATED_AT = 'uploaded_at';
    public const UPDATED_AT = 'updated_at';

    /** @return BelongsTo<MaintenanceRecord, $this> */
    public function maintenanceRecord(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_id');
    }

    /** @return BelongsTo<UserAccount, $this> */
    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(UserAccount::class, 'uploaded_by');
    }
}
