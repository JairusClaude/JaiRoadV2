<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Temporary fail-closed quarantine: DD-linked login must not send business
 * requests to legacy public.* endpoints during the staged cutover.
 * Fortify login, logout, session, two-factor, passkeys and password recovery
 * are NOT blocked by this middleware.
 */
final class DenyLegacyBusinessRoutesForDd
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user instanceof User && $user->getAttribute('dd_user_account_id') !== null) {
            // Redirect only exact, read-only module entry points. Never translate
            // legacy entity IDs, file paths, or mutation requests across schemas.
            $directories = [
                'maintenance-projects' => 'projects',
                'monthly-updates-preview' => 'updates', 'monthly-updates' => 'updates',
                'project-documents-preview' => 'documents',
                'road-sections-preview' => 'roads', 'lgus-preview' => 'lgus',
                'user-management' => 'users', 'settings-preview' => 'settings',
                'admin-dashboard' => 'dashboard', 'role-dashboard' => 'dashboard',
                'superadmin-dashboard' => 'dashboard',
                'settings/profile' => 'settings',
            ];
            $section = $directories[$request->path()] ?? null;
            if (($request->isMethod('GET') || $request->isMethod('HEAD')) && $section !== null) {
                $identity = app(DataDictionaryIdentityResolver::class)->resolve($user);
                abort_unless($identity !== null, 403, 'Your account is unavailable. Please contact your administrator.');

                return redirect()->route('jairoads.dd-phase3.show', ['section' => $section]);
            }
            // Legacy profile/password actions modify only public.users and can
            // invalidate a DD identity whose two password hashes must match.
            // Keep them read-only until coordinated DD credential actions exist.
            if (! $request->isMethod('GET') && ! $request->isMethod('HEAD')
                && $request->is('settings/profile', 'settings/password')) {
                abort(403, 'Update your account through Settings in your workspace.');
            }
            if ($request->is(
                'road-coverages', 'road-coverages/*', 'lgus', 'lgus/*',
                'engineers', 'engineers/*',
                'maintenance-projects', 'maintenance-projects/*',
                'maintenance-records', 'maintenance-records/*',
                'monthly-updates', 'monthly-updates/*',
                'monthly-updates-preview', 'monthly-updates-preview/*',
                'maintenance-documents', 'maintenance-documents/*',
                'media', 'media/*', 'user-accounts', 'user-accounts/*',
                'user-management', 'user-management/*',
                'lgus-preview', 'lgus-preview/*',
                'road-sections-preview', 'road-sections-preview/*',
                'project-documents-preview', 'project-documents-preview/*',
                'settings-preview', 'settings-preview/*',
                'admin-dashboard', 'admin-dashboard/*',
                'superadmin-dashboard', 'superadmin-dashboard/*',
                'superadmin-command-center', 'superadmin-command-center/*',
                'role-dashboard', 'role-dashboard/*',
                'jairoads-notifications', 'jairoads-notifications/*',
            )) {
                abort(403, 'This page is unavailable for your account. Open the module from your workspace navigation.');
            }
        }

        return $next($request);
    }
}
