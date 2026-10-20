<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

/**
 * Role gates for the approved DD business model.
 *
 * The ordinary entity CRUD matrix intentionally overlaps for SuperAdmin and
 * Admin. This class does NOT confer extra system governance powers on Admin.
 * Resource ownership, active EngineerLGU membership, required foreign keys,
 * record management and data integrity are checked by the controllers on
 * each request, not by this preliminary role-level permission map.
 */
final class DdRoleAccess
{
    private const MANAGERS = ['SuperAdmin', 'Admin'];

    public static function managesBusinessData(string $role): bool
    {
        return in_array($role, self::MANAGERS, true);
    }

    public static function canWriteOperations(string $role): bool
    {
        return self::managesBusinessData($role) || $role === 'Engineer';
    }

    public static function canDeleteOperations(string $role): bool
    {
        return self::managesBusinessData($role);
    }

    public static function canManageAccounts(string $role): bool
    {
        return self::managesBusinessData($role);
    }

    public static function canReadAuditLog(string $role): bool
    {
        return self::managesBusinessData($role);
    }

    /**
     * UI guide only: endpoint guards additionally require a live Engineer identity and active LGU scope.
     *
     * @return array{role: string, manageAccounts: bool, readAuditLog: bool, createProjects: bool, updateProjects: bool, deleteProjects: bool, createRoads: bool, updateRoads: bool, deleteRoads: bool, createUpdates: bool, createDocuments: bool, manageLgus: bool, readOnly: bool, assignedScope: bool}
     */
    public static function capabilities(string $role, bool $hasAssignment, bool $linkedEngineer): array
    {
        $manager = self::managesBusinessData($role);
        $engineerScoped = $role === 'Engineer' && $hasAssignment && $linkedEngineer;

        return [
            'role' => $role,
            'manageAccounts' => $manager,
            'readAuditLog' => $manager,
            'createProjects' => $manager || $engineerScoped,
            'updateProjects' => $manager || $engineerScoped,
            'deleteProjects' => $manager,
            'createRoads' => $manager || $engineerScoped,
            'updateRoads' => $manager || $engineerScoped,
            'deleteRoads' => $manager,
            'createUpdates' => $manager || $engineerScoped,
            'createDocuments' => $manager || $engineerScoped,
            'manageLgus' => $manager,
            'readOnly' => $role === 'Viewer',
            'assignedScope' => $engineerScoped,
        ];
    }
}
