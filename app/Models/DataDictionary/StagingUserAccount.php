<?php

declare(strict_types=1);

namespace App\Models\DataDictionary;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * @property string $username
 * @property bool $is_active
 *
 * Read-only bridge for the NEW Data Dictionary account table.
 * NOT a Fortify login model. Never infer a match from a legacy numeric ID.
 * Do not use for account provisioning until the approved cutover.
 */
final class StagingUserAccount extends Model
{
    protected $table = 'jairoads_next.user_accounts';

    /** @var list<string> */
    protected $guarded = ['*'];

    /** @var list<string> */
    protected $hidden = ['password'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsTo<StagingEngineer, $this> */
    public function engineer(): BelongsTo
    {
        return $this->belongsTo(StagingEngineer::class, 'engineer_id');
    }

    public function save(array $options = []): bool
    {
        throw new LogicException('Staging DD account model is read-only until coordinated cutover.');
    }

    public function delete(): ?bool
    {
        throw new LogicException('Staging DD account model is read-only until coordinated cutover.');
    }
}
