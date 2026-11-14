<?php

declare(strict_types=1);

use App\Services\PostgresBoolean;

it('accepts only recognized true PostgreSQL boolean representations', function (): void {
    foreach ([true, 1, '1', 't', 'true'] as $value) {
        expect(PostgresBoolean::isTrue($value))->toBeTrue();
    }

    foreach ([false, 0, '0', 'f', 'false', null, '', 'any value', 2] as $value) {
        expect(PostgresBoolean::isTrue($value))->toBeFalse();
    }
});
