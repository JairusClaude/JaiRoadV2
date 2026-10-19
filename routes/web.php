<?php

use App\Http\Controllers\EngineerController;
use App\Http\Controllers\LguController;
use App\Http\Controllers\MaintenanceDocumentController;
use App\Http\Controllers\MaintenanceProjectController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\MonthlyUpdateController;
use App\Http\Controllers\RoadCoverageController;
use App\Http\Controllers\UserAccountController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    // Fortify's /dashboard entry now resolves role-specific JaiROADS dashboards.
    // Never use Laravel's default starter dashboard for authorized Engineer/Viewer roles.
    Route::get('dashboard', function (): \Illuminate\Http\RedirectResponse {
        $user = request()->user();
        if ($user instanceof \App\Models\User && $user->getAttribute('dd_user_account_id') !== null) {
            // DD-linked login is resolved exclusively through the approved DD identity.
            // Never fall back to legacy roles when a DD link is invalid.
            $identity = app(\App\Services\DataDictionary\DataDictionaryIdentityResolver::class)->resolve($user);
            abort_unless($identity !== null, 403, 'An active linked Data Dictionary UserAccount is required.');
            return match ($identity['role']) {
                'SuperAdmin' => redirect()->route('jairoads.dd-superadmin-landing'),
                'Admin', 'Engineer', 'Viewer' => redirect()->route('jairoads.dd-phase3.show', ['section' => 'dashboard']),
                default => abort(403, 'This Data Dictionary role awaits the guarded module cutover.'),
            };
        }

        // Historical Fortify users remain on the unchanged legacy route path.
        $role = app(\App\Services\MaintenanceProjects\VerifiedProjectAccount::class)
            ->role($user);
        return match ($role) {
            'admin' => redirect()->route('jairoads.admin-dashboard'),
            'superadmin' => redirect()->route('jairoads.superadmin-dashboard'),
            'engineer', 'viewer' => redirect()->route('jairoads.role-dashboard'),
            default => abort(403, 'An active linked JaiROADS UserAccount is required.'),
        };
    })->name('dashboard');

    Route::resource('road-coverages', RoadCoverageController::class)
        ->parameters([
            'road-coverages' => 'roadCoverage',
        ]);

    Route::resource('lgus', LguController::class);

    // Engineer directory remains read-only for ordinary users per the final Data Dictionary.
    Route::get('engineers', [EngineerController::class, 'index'])->name('engineers.index');

    Route::delete(
        'maintenance-projects/bulk',
        [
            MaintenanceProjectController::class,
            'bulkDestroy',
        ]
    )->name('maintenance-projects.bulk-destroy');

    Route::resource(
        'maintenance-projects',
        MaintenanceProjectController::class
    );

    // Phase B2: read-only Maintenance Record listing. Existing quick-create stays unchanged.
    // Regular record write routes require a separate authorization review.
    Route::get('maintenance-records', [\App\Http\Controllers\MaintenanceRecordReadOnlyController::class, 'index'])
        ->name('maintenance-records.index');

    Route::resource(
        'monthly-updates',
        MonthlyUpdateController::class
    );

    Route::resource(
        'maintenance-documents',
        MaintenanceDocumentController::class
    )->parameters([
        'maintenance-documents' => 'maintenanceDocument',
    ]);

    Route::resource('media', MediaController::class)
        ->parameters(['media' => 'media']);

    Route::resource('user-accounts', UserAccountController::class);
});

require __DIR__.'/settings.php';

require __DIR__.'/user-management.php';

require __DIR__.'/monthly-updates-preview.php';


require __DIR__.'/project-documents-preview.php';


require __DIR__.'/road-sections-preview.php';

require __DIR__.'/lgus-preview.php';

require __DIR__.'/settings-preview.php';

require __DIR__.'/admin-dashboard.php';
require __DIR__.'/jairoads-notifications.php';

// Role identity is shared with Inertia views, including existing JaiROADS modules.
// Do not infer operational roles from Laravel users.id, name, or email.
\Inertia\Inertia::share('jairoadsIdentity', static function (): ?array {
    $user = request()->user();
    if (! $user instanceof \App\Models\User) {
        return null;
    }
    try {
        // Never infer DD authority from an old user_account_id or legacy role.
        if ($user->getAttribute('dd_user_account_id') !== null) {
            $identity = app(\App\Services\DataDictionary\DataDictionaryIdentityResolver::class)->resolve($user);
            if ($identity === null) {
                return null;
            }
            $username = \App\Models\DataDictionary\StagingUserAccount::query()
                ->whereKey($identity['account_id'])->value('username');
            if (! is_string($username) || $username === '') {
                return null;
            }
            return [
                'role' => strtolower($identity['role']),
                'username' => $username,
                'name' => (string) $user->name,
            ];
        }

        $access = app(\App\Services\MaintenanceProjects\VerifiedProjectAccount::class);
        $account = $access->resolve($user);
        $role = $access->role($user);
        if (! $account || ! $role) {
            return null;
        }
        return [
            'role' => $role,
            'username' => (string) $account->username,
            'name' => (string) $user->name,
        ];
    } catch (\Throwable) {
        return null; // Fail closed if operational account lookup fails.
    }
});


// Dedicated read-only landing for the first DD-linked SuperAdmin. This does NOT
// grant legacy CRUD access or replace the existing command center.
\Illuminate\Support\Facades\Route::middleware(['auth', 'verified'])
    ->get('/dd-superadmin-landing', \App\Http\Controllers\Dashboard\DdSuperAdminLandingController::class)
    ->name('jairoads.dd-superadmin-landing');

require __DIR__.'/role-dashboard.php';

// Dedicated governance command center, never exposed to Admin/Engineer/Viewer.
require __DIR__.'/superadmin-dashboard.php';
require __DIR__.'/dd-phase3.php';
