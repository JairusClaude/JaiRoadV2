<?php

declare(strict_types=1);

use App\Http\Controllers\AccountProvisioningController;
use App\Http\Controllers\UserManagement\EngineerAdministrationController;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use App\Services\UserManagement\AccountProvisioningRoles;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Explicitly linked Admin / SuperAdmin only. Read operations remain unchanged.
Route::middleware(['auth', 'verified'])->group(function (): void {
    Route::get('/user-management', function () {
        $role = app(VerifiedProjectAccount::class)->role(request()->user());
        abort_unless(in_array($role, ['admin', 'superadmin'], true), 403);
        $creatableRoles = app(AccountProvisioningRoles::class)->for(request()->user());
        // Phase A already deployed engineer_lgus. Reflect actual assignments
        // rather than hardcoding an empty UI list; this is read-only.
        $assignmentsAvailable = Schema::hasTable('engineer_lgus');
        $assignments = $assignmentsAvailable
            ? DB::table('engineer_lgus')
                ->orderBy('engineers_id')
                ->orderBy('lgus_id')
                ->get(['engineers_id', 'lgus_id', 'is_active'])
                ->map(static fn ($assignment) => [
                    'id' => (string) $assignment->engineers_id.':'.(string) $assignment->lgus_id,
                    'engineers_id' => (int) $assignment->engineers_id,
                    'lgus_id' => (int) $assignment->lgus_id,
                    'is_active' => (bool) $assignment->is_active,
                ])
                ->all()
            : [];

        return Inertia::render('user-management/Index', [
            'initialAccounts' => DB::table('user_accounts')
                ->select('id', 'username', 'accountType', 'is_active', 'engineers_id', 'created_by')
                ->orderBy('id')->get(),
            'initialEngineers' => DB::table('engineers')
                ->select('id', 'first_name', 'middle_name', 'last_name', 'email', 'contact_no', 'position', 'rank', 'lgus_id', 'engineer_status')
                ->orderBy('id')->get(),
            'initialLgus' => DB::table('lgus')
                ->select('id', 'municipality_name')->orderBy('id')->get(),
            'initialAssignments' => $assignments,
            'assignmentsAvailable' => $assignmentsAvailable,
            'canManage' => true,
            'creatableRoles' => $creatableRoles,
            'engineerRoleReady' => in_array('engineer', $creatableRoles, true),
            'flashStatus' => session('user_management_status') ?? session('account_created'),
        ]);
    })->name('user-management.index');

    Route::post('/user-management/accounts', [AccountProvisioningController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('user-management.accounts.store');

    // Admin and SuperAdmin only, independently checked inside every controller
    // action. Keep all workflows within the EXISTING User Management sidebar.
    Route::post('/user-management/engineers', [EngineerAdministrationController::class, 'storeEngineer'])
        ->middleware('throttle:10,1')->name('user-management.engineers.store');
    Route::patch('/user-management/engineers/{engineer}', [EngineerAdministrationController::class, 'updateEngineer'])
        ->whereNumber('engineer')->middleware('throttle:20,1')->name('user-management.engineers.update');
    Route::post('/user-management/assignments', [EngineerAdministrationController::class, 'storeAssignment'])
        ->middleware('throttle:10,1')->name('user-management.assignments.store');
    Route::patch('/user-management/assignments/{engineer}/{lgu}', [EngineerAdministrationController::class, 'setAssignmentStatus'])
        ->whereNumber('engineer')->whereNumber('lgu')->middleware('throttle:20,1')
        ->name('user-management.assignments.status');
});
