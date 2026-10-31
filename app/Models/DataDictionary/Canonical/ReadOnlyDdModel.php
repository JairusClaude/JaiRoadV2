<?php

declare(strict_types=1);

namespace App\Models\DataDictionary\Canonical;

use Illuminate\Database\Eloquent\Model;
use LogicException;

/**
 * Review-only, isolated, schema-qualified reference model.
 * Not an authorization boundary: Eloquent bulk update/delete queries bypass save/delete.
 * Not used by existing routes/controllers; never enable writes without approved guards.
 */
abstract class ReadOnlyDdModel extends Model
{
    protected $guarded = ['*'];

    public function save(array $options = []): bool
    {
        throw new LogicException('Canonical DD reference model is read-only; no cutover approved.');
    }

    public function delete(): ?bool
    {
        throw new LogicException('Canonical DD reference model is read-only; no cutover approved.');
    }
}
