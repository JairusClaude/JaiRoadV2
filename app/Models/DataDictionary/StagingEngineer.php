<?php

declare(strict_types=1);

namespace App\Models\DataDictionary;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use LogicException;

/** Read-only Engineer model for the isolated jairoads_next schema. */
final class StagingEngineer extends Model
{
    protected $table = 'jairoads_next.engineers';

    /** @var list<string> */
    protected $guarded = ['*'];

    /** @return HasMany<StagingUserAccount, $this> */
    public function accounts(): HasMany
    {
        return $this->hasMany(StagingUserAccount::class, 'engineer_id');
    }

    public function save(array $options = []): bool
    {
        throw new LogicException('Staging DD Engineer model is read-only until coordinated cutover.');
    }

    public function delete(): ?bool
    {
        throw new LogicException('Staging DD Engineer model is read-only until coordinated cutover.');
    }
}
