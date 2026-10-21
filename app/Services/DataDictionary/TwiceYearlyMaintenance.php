<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Validation\ValidationException;

/** Derived from persisted history, never a persisted project schedule. */
final class TwiceYearlyMaintenance
{
    /**
     * @param  iterable<\stdClass>  $records  Complete project history, not a paginated listing.
     * @return array{pattern: ?array<string>, years: array<int, array{year:int, quarters:array<string>, missing:array<string>, state:string}>, conflict:bool, next:?array{year:int, quarter:string}}
     */
    public function summarize(iterable $records): array
    {
        $years = [];
        $pairs = [];
        $conflict = false;
        foreach ($records as $record) {
            $year = (int) $record->maintenance_year;
            $quarter = (string) $record->quarter;
            if (! in_array($quarter, ['Q1', 'Q2', 'Q3', 'Q4'], true)) {
                $conflict = true;
            } else {
                $pairs[in_array($quarter, ['Q1', 'Q3'], true) ? 'A' : 'B'] = true;
            }
            if (in_array($quarter, $years[$year] ?? [], true)) {
                $conflict = true;
            }
            $years[$year][] = $quarter;
        }
        $conflict = $conflict || count($pairs) > 1;
        $pattern = count($pairs) === 1 && ! $conflict
            ? (isset($pairs['A']) ? ['Q1', 'Q3'] : ['Q2', 'Q4']) : null;
        ksort($years);
        $annual = [];
        $next = null;
        foreach ($years as $year => $quarters) {
            sort($quarters);
            $missing = $pattern === null ? [] : array_values(array_diff($pattern, $quarters));
            $annual[] = ['year' => $year, 'quarters' => $quarters, 'missing' => $missing,
                'state' => $conflict ? 'review' : ($missing === [] ? 'complete' : 'partial')];
            if ($pattern !== null) {
                $next = in_array($pattern[1], $quarters, true)
                    ? ['year' => $year + 1, 'quarter' => $pattern[0]]
                    : ['year' => $year, 'quarter' => $pattern[1]];
            }
        }

        return ['pattern' => $pattern, 'years' => $annual, 'conflict' => $conflict, 'next' => $next];
    }

    /** @param iterable<\stdClass> $records Must be read while holding the parent project lock. */
    public function validateCreation(iterable $records, int $year, string $quarter): void
    {
        $summary = $this->summarize($records);
        if ($summary['conflict']) {
            throw ValidationException::withMessages(['quarter' => 'Existing maintenance history needs administrator review before adding a period. No history has been changed.']);
        }
        foreach ($summary['years'] as $annual) {
            if ($annual['year'] === $year && in_array($quarter, $annual['quarters'], true)) {
                throw ValidationException::withMessages(['quarter' => 'This project already has a maintenance record for that year and quarter.']);
            }
        }
        $pattern = $summary['pattern'];
        if ($pattern === null && ! in_array($quarter, ['Q1', 'Q2'], true)) {
            throw ValidationException::withMessages(['quarter' => 'Start the schedule with Q1 (then Q3) or Q2 (then Q4).']);
        }
        if ($pattern !== null && ! in_array($quarter, $pattern, true)) {
            throw ValidationException::withMessages(['quarter' => 'This project follows '.$pattern[0].' / '.$pattern[1].'. A schedule change requires separate approval.']);
        }
        if ($pattern !== null && $quarter === $pattern[1]) {
            $firstExists = false;
            foreach ($summary['years'] as $annual) {
                $firstExists = $firstExists || ($annual['year'] === $year && in_array($pattern[0], $annual['quarters'], true));
            }
            if (! $firstExists) {
                throw ValidationException::withMessages(['quarter' => 'Record the corresponding first-half maintenance period for this year first.']);
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
