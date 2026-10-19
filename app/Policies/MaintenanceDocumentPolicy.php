<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\MaintenanceDocument;
use App\Models\MaintenanceRecord;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;

/** The Engineer path fails closed unless a real active EngineerLGU assignment exists. */
class MaintenanceDocumentPolicy
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    public function viewAny(User $user): bool
    {
        return $this->accounts->role($user) !== null;
    }

    public function view(User $user, MaintenanceDocument $document): bool
    {
        $role = $this->accounts->role($user);
        if ($role === null) {
            return false;
        }
        // Admin, SuperAdmin and Viewer can view. Engineer downloads must
        // satisfy BOTH the managing-Engineer and active LGU assignment rules.
        if ($role !== 'engineer') {
            return true;
        }
        $record = $document->maintenanceRecord;
        return $record instanceof MaintenanceRecord
            && $this->createForRecord($user, $record);
    }

    public function create(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin', 'engineer'], true);
    }

    public function createForRecord(User $user, MaintenanceRecord $record): bool
    {
        $role = $this->accounts->role($user);
        if (in_array($role, ['admin', 'superadmin'], true)) {
            return true;
        }
        if ($role !== 'engineer') {
            return false;
        }
        $account = $this->accounts->resolve($user);
        $engineerId = $account?->engineers_id;
        if (! $engineerId || (int) $engineerId !== (int) $record->engineers_id) {
            return false;
        }

        $coverage = $record->maintenanceProject?->roadCoverage;
        return $coverage !== null && $this->accounts->assignedTo($account, $coverage);
    }

    // Edit/delete workflows require separately reviewed storage-retention and audit behavior.
    public function update(User $user, MaintenanceDocument $document): bool { return false; }
    public function delete(User $user, MaintenanceDocument $document): bool { return false; }
    public function restore(User $user, MaintenanceDocument $document): bool { return false; }
    public function forceDelete(User $user, MaintenanceDocument $document): bool { return false; }
}
