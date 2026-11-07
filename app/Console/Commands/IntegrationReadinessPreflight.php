<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\IntegrationDeploymentReadiness;
use Illuminate\Console\Command;

/** No network calls, SQL writes, passwords, tokens, private URLs or personal data. */
final class IntegrationReadinessPreflight extends Command
{
    protected $signature = 'jairoads:integration-readiness';

    protected $description = 'Read-only, credential-free integration configuration and manual acceptance gates';

    public function handle(IntegrationDeploymentReadiness $readiness): int
    {
        $this->line(json_encode($readiness->report(), JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        // Exit 0 for a readable report; false checks stay explicit and are
        // not silently treated as a release or production readiness approval.
        return self::SUCCESS;
    }
}
