<?php

namespace App\Console\Commands;

use App\Services\Files\FileRecoverySchedule;
use App\Services\Files\PermanentFileDeletion;
use Illuminate\Console\Command;

final class ResumeFileDeletions extends Command
{
    protected $signature = 'jairoads:resume-file-deletions
        {--limit=50 : Maximum accepted commands to retry in this batch}
        {--budget= : Seconds after which the batch stops starting new operations}
        {--scheduled : Record that the scheduler invocation was requested}';

    protected $description = 'Reconcile previously authorized individual file deletions; never accepts a path or creates a new deletion command';

    public function handle(PermanentFileDeletion $deletions): int
    {
        if (! $deletions->operationallyEnabled()) {
            $this->error('File deletion recovery is unavailable; schema-owner setup is required.');

            return self::FAILURE;
        }
        $limit = filter_var($this->option('limit'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
        if ($limit === false) {
            $this->error('Limit must be 1–1000.');

            return self::FAILURE;
        }
        $budget = $this->option('budget');
        $seconds = $budget === null ? null : filter_var($budget, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 3600]]);
        if ($seconds === false) {
            $this->error('Budget must be 1–3600 seconds.');

            return self::FAILURE;
        }
        $deadline = $seconds === null ? null : hrtime(true) + $seconds * 1_000_000_000;
        $attempted = 0;
        $completed = 0;
        $budgetReached = false;
        foreach ($deletions->pendingIds($limit) as $id) {
            if ($deadline !== null && hrtime(true) >= $deadline) {
                $this->warn('Batch budget reached. Remaining operations will be retried in a later run.');

                $budgetReached = true;
                break;
            }
            $result = $deletions->process($id);
            $attempted++;
            $completed += $result['state'] === 'completed' ? 1 : 0;
            $this->line('Operation '.$id.': '.$result['state']);
        }
        FileRecoverySchedule::recordRun($attempted, $completed, $budgetReached, $this->option('scheduled') === true);

        return $attempted !== $completed ? self::FAILURE : self::SUCCESS;
    }
}
