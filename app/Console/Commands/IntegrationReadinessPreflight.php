<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\IntegrationDeploymentReadiness;
use Illuminate\Console\Command;

/** No network calls, SQL writes, passwords, tokens, private URLs or personal data. */
final class IntegrationReadinessPreflight extends Command
{
    protected $signature = 'jairoads:integration-readiness {--strict : Return a failing exit code when any configuration gate is false}';

    protected $description = 'Read-only, credential-free integration configuration and manual acceptance gates';

    public function handle(IntegrationDeploymentReadiness $readiness): int
    {
        $report = $readiness->report();
        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        // Existing informational invocation remains backward compatible.
        // Release automation may opt into a nonzero exit status, but this
        // still does not substitute for external service tests or human UAT.
        return $this->option('strict') && ! $report['ready_for_live_probes'] ? self::FAILURE : self::SUCCESS;
    }
}
