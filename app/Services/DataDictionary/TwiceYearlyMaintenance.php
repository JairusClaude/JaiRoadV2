<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Validation\ValidationException;

/** Quarter availability derived from history. The historical class name is retained for compatibility. */
final class TwiceYearlyMaintenance
{
    private const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

    /**
     * @param  iterable<\stdClass>  $records  Complete project history, not a paginated listing.
     * @return array{years:array<int,array{year:int,quarters:array<string>,available:array<string>}>,conflict:bool}
     */
    public function summarize(iterable $records): array
    {
        $years = [];
        $conflict = false;
        foreach ($records as $record) {
            $year = (int) $record->maintenance_year;
            $quarter = (string) $record->quarter;
            $conflict = $conflict || ! in_array($quarter, self::QUARTERS, true)
                || in_array($quarter, $years[$year] ?? [], true);
            $years[$year][] = $quarter;
        }
        ksort($years);
        $annual = [];
        foreach ($years as $year => $quarters) {
            sort($quarters);
            $annual[] = ['year' => $year, 'quarters' => $quarters,
                'available' => array_values(array_diff(self::QUARTERS, $quarters))];
        }

        return ['years' => $annual, 'conflict' => $conflict];
    }

    /** @param iterable<\stdClass> $records Must be read while holding the parent project lock. */
    public function validateCreation(iterable $records, int $year, string $quarter): void
    {
        foreach ($records as $record) {
            if ((int) $record->maintenance_year === $year && $record->quarter === $quarter) {
                throw ValidationException::withMessages(['quarter' => 'This project already has a maintenance record for that year and quarter.']);
            }
        }
    }

    public function validateStart(int $year, string $quarter, string $date): void
    {
        $start = new \DateTimeImmutable($date);
        $actualQuarter = 'Q'.(int) ceil((int) $start->format('n') / 3);
        if ((int) $start->format('Y') !== $year || $actualQuarter !== $quarter) {
            throw ValidationException::withMessages(['start_date' => 'Start date must fall within the selected maintenance year and quarter.']);
        }
    }
}
