<?php

declare(strict_types=1);

use App\Services\MonthlyUpdates\MonthlySubmissionReceipt;

test('current receipt fingerprints compare exact decimal values and retain legacy replay support', function (): void {
    $base = MonthlySubmissionReceipt::fingerprints(1, 2, '2026-11', '50', 'Résumé');
    $equivalent = MonthlySubmissionReceipt::fingerprints(1, 2, '2026-11', '050.00', 'Résumé');
    $distinct = MonthlySubmissionReceipt::fingerprints(1, 2, '2026-11', '50.001', 'Résumé');
    $changedText = MonthlySubmissionReceipt::fingerprints(1, 2, '2026-11', '50', 'Resume');
    $legacy = hash('sha256', json_encode([1, 1, 2, '2026-11', '50', 'Résumé'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));

    expect($base[0])->toBe($equivalent[0])
        ->not->toBe($distinct[0])
        ->not->toBe($changedText[0]);
    expect($base[1])->toBe($legacy)->not->toBe($equivalent[1]);
});
