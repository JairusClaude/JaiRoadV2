<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Physical Supabase table: updates_media.
 * The data dictionary's UploadedBy FK is not deployed on this table.
 *
 * @property int $id
 * @property int $monthly_updates_id
 * @property string $file_name
 * @property string $file_path
 * @property string $file_type
 */
class Media extends Model
{
    protected $table = 'updates_media';

    // Prevent writes until the controller and the physical schema agree.
    protected $guarded = ['*'];

    /** @return BelongsTo<MonthlyUpdate, $this> */
    public function monthlyUpdate(): BelongsTo
    {
        return $this->belongsTo(MonthlyUpdate::class, 'monthly_updates_id');
    }
}
