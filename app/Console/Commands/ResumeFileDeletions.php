<?php

namespace App\Console\Commands;

use App\Services\Files\PermanentFileDeletion;
use Illuminate\Console\Command;

final class ResumeFileDeletions extends Command
{
    protected $signature = 'jairoads:resume-file-deletions
        {--limit=50 : Maximum accepted commands to retry in this batch}
        {--budget= : Seconds after which the batch stops starting new operations}';

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
        $pending = false;
        foreach ($deletions->pendingIds($limit) as $id) {
            if ($deadline !== null && hrtime(true) >= $deadline) {
                $this->warn('Batch budget reached. Remaining operations will be retried in a later run.');

                return $pending ? self::FAILURE : self::SUCCESS;
            }
            $result = $deletions->process($id);
            $this->line('Operation '.$id.': '.$result['state']);
            $pending = $pending || $result['state'] !== 'completed';
        }

        return $pending ? self::FAILURE : self::SUCCESS;
    }
}
