<?php

namespace App\Policies;

use App\Models\MaintenanceRecord;
use App\Models\User;

class MaintenanceRecordPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->exists;
    }

    public function view(
        User $user,
        MaintenanceRecord $maintenanceRecord
    ): bool {
        return $user->exists;
    }

    public function create(User $user): bool
    {
        return $user->exists;
    }

    public function update(
        User $user,
        MaintenanceRecord $maintenanceRecord
    ): bool {
        return $user->exists;
    }

    public function delete(
        User $user,
        MaintenanceRecord $maintenanceRecord
    ): bool {
        return $user->exists;
    }

    public function restore(
        User $user,
        MaintenanceRecord $maintenanceRecord
    ): bool {
        return false;
    }

    public function forceDelete(
        User $user,
        MaintenanceRecord $maintenanceRecord
    ): bool {
        return false;
    }
}
