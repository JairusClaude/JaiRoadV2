<?php

// JaiROADS Settings UI preview. Read-only database access for the current user.
// Existing Laravel profile, password, appearance, 2FA and passkey routes are retained.
// Do not bypass account/role authorization for operational data from this page.

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::middleware(['auth', 'verified'])->get('/settings-preview', function () {
    $user = request()->user();
    $account = null;
    $engineer = null;
    $municipality = null;

    // Current Laravel User -> approved explicit UserAccount link.
    // Never expose passwords, hashes, remember tokens, MFA secrets, or other users.
    if ($user->user_account_id !== null && Schema::hasTable('user_accounts')) {
        $account = DB::table('user_accounts')
            ->where('id', $user->user_account_id)
            ->first(['username', 'accountType', 'is_active', 'engineers_id']);
    }

    if ($account && $account->engineers_id !== null && Schema::hasTable('engineers')) {
        $engineer = DB::table('engineers')->where('id', $account->engineers_id)
            ->first(['first_name', 'middle_name', 'last_name', 'position', 'lgus_id']);
        if ($engineer && $engineer->lgus_id !== null && Schema::hasTable('lgus')) {
            $municipality = DB::table('lgus')->where('id', $engineer->lgus_id)->value('municipality_name');
        }
    }

    // Show links only if the actual app has registered GET pages.
    $hasGetPath = static function (string $uri): bool {
        foreach (Route::getRoutes()->getRoutes() as $route) {
            if (in_array('GET', $route->methods(), true) && trim($route->uri(), '/') === trim($uri, '/')) {
                return true;
            }
        }

        return false;
    };
    $pathOrNull = static fn (string $path): ?string => $hasGetPath($path) ? '/'.trim($path, '/') : null;

    return Inertia::render('settings-preview/Index', [
        'account' => [
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'verified' => $user->hasVerifiedEmail(),
            'joinedAt' => $user->created_at?->toDateString(),
            'username' => $account?->username,
            'accountType' => $account?->accountType,
            'active' => $account ? (bool) $account->is_active : null,
            'engineerName' => $engineer ? trim(implode(' ', array_filter([
                $engineer->first_name, $engineer->middle_name, $engineer->last_name,
            ]))) : null,
            'engineerPosition' => $engineer?->position,
            'municipality' => $municipality,
        ],
        'availableLinks' => [
            'profile' => $pathOrNull('settings/profile'),
            'password' => $pathOrNull('settings/security'),
            'appearance' => $pathOrNull('settings/appearance'),
            'twoFactor' => Features::canManageTwoFactorAuthentication() ? $pathOrNull('settings/security') : null,
            'passkeys' => Features::canManagePasskeys() ? $pathOrNull('settings/security') : null,
        ],
    ]);
})->name('settings.preview');
