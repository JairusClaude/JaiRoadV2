<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\DeploymentTargetSafety;
use Illuminate\Console\Command;

final class DeploymentTargetPreflight extends Command
{
    protected $signature = 'jairoads:deployment-target-preflight';

    protected $description = 'Reject mismatched hosted database projects, elevated login names and ephemeral release settings';

    public function handle(DeploymentTargetSafety $safety): int
    {
        $report = $safety->report();
        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return $report['safe_for_release_probes'] ? self::SUCCESS : self::FAILURE;
    }
}
