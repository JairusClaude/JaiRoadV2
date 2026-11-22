<?php

declare(strict_types=1);

use App\Support\LiteralDirectorySearch;

test('literal directory search escapes SQL pattern characters and bounds unicode input', function (): void {
    expect(LiteralDirectorySearch::normalize(['untrusted']))->toBe('')
        ->and(LiteralDirectorySearch::normalize('   '))->toBe('')
        ->and(LiteralDirectorySearch::normalize('  Hello  '))->toBe('Hello')
        ->and(LiteralDirectorySearch::normalize(str_repeat('é', 151)))->toBe(str_repeat('é', 150))
        ->and(LiteralDirectorySearch::option(['incorrect']))->toBe('all')
        ->and(LiteralDirectorySearch::option(['incorrect'], 'newest'))->toBe('newest')
        ->and(LiteralDirectorySearch::option('  DESC  '))->toBe('DESC')
        ->and(LiteralDirectorySearch::pattern('50%_'))->toBe('%50\\%\\_%');
});
