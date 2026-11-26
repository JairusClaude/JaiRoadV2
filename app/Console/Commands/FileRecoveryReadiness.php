<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Files\FileRecoverySchedule;
use Illuminate\Console\Command;

final class FileRecoveryReadiness extends Command
{
    protected $signature = 'jairoads:file-recovery-readiness';

    protected $description = 'Report scheduler configuration without accessing Storage, deleting files, or changing database records';

    public function handle(): int
    {
        $report = FileRecoverySchedule::readiness();
        $this->line(json_encode($report + ['runtime_verified' => false, 'manual_approval_required' => true], JSON_THROW_ON_ERROR));

        return $report['registration_allowed'] ? self::SUCCESS : self::FAILURE;
    }
}
