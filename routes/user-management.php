<?php

declare(strict_types=1);

use App\Http\Controllers\AccountProvisioningController;
use App\Http\Controllers\UserManagement\EngineerAdministrationController;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use App\Services\UserManagement\AccountProvisioningRoles;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

// Explicitly linked Admin / SuperAdmin only. Read operations remain unchanged.
Route::middleware(['web'])->group(function (): void {
    Route::get('/user-management', function () {
        if (\App\Http\Controllers\OperationsFrontendController::isPreview(request())) {
            $store = \App\Services\PreviewDataService::getStore();
            $accounts = [
                ['id' => 1, 'username' => 'User1', 'accountType' => 'admin', 'is_active' => true, 'engineers_id' => 1, 'created_by' => null],
                ['id' => 2, 'username' => 'User2', 'accountType' => 'user', 'is_active' => true, 'engineers_id' => 2, 'created_by' => null],
                ['id' => 3, 'username' => 'User3', 'accountType' => 'user', 'is_active' => true, 'engineers_id' => 3, 'created_by' => null],
                ['id' => 4, 'username' => 'User4', 'accountType' => 'user', 'is_active' => true, 'engineers_id' => 4, 'created_by' => null],
                ['id' => 5, 'username' => 'chelsey74', 'accountType' => 'admin', 'is_active' => true, 'engineers_id' => null, 'created_by' => null],
            ];
            $engineers = collect($store['engineers'] ?? [])->map(fn ($e) => [
                'id' => (int) $e['id'],
                'first_name' => $e['first_name'],
                'middle_name' => null,
                'last_name' => $e['last_name'],
                'email' => strtolower($e['first_name'].'.'.$e['last_name'].'@jairoads.gov.ph'),
                'contact_no' => '09123456789',
                'position' => $e['rank'] ?? 'Field Engineer',
                'rank' => $e['rank'] ?? 'Field Engineer',
                'lgus_id' => (int) ($e['lgu_id'] ?? 1),
                'engineer_status' => 'Active',
            ])->all();
            $lgus = collect($store['lgus'] ?? [])->map(fn ($l) => [
                'id' => (int) $l['id'],
                'municipality_name' => $l['municipality_name'],
            ])->all();

            return \App\Services\PreviewDataService::render('user-management/Index', request(), [
                'initialAccounts' => $accounts,
                'initialEngineers' => $engineers,
                'initialLgus' => $lgus,
                'initialAssignments' => [],
                'assignmentsAvailable' => true,
                'canManage' => true,
                'creatableRoles' => ['admin', 'engineer', 'viewer'],
                'engineerRoleReady' => true,
                'flashStatus' => session('user_management_status') ?? session('account_created'),
                'navigationSection' => 'user-management',
            ]);
        }

        abort_unless(request()->user() !== null, 401);
        $role = app(VerifiedProjectAccount::class)->role(request()->user());
        if ($role === null) {
            $identity = app(\App\Services\AccountIdentityResolver::class)->resolve(request()->user());
            $role = $identity ? strtolower((string) $identity['role']) : null;
        }
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
            'canonicalFrontend' => true,
            'jairoadsIdentity' => ['role' => strtolower($role)],
            'navigationSection' => 'user-management',
        ]);
    })->name('user-management.index');

    Route::get('/user-accounts', function () {
        return redirect()->route('user-management.index');
    });

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
