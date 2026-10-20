<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Dispatches one approved DD section to its existing, individually authorized
 * controller. Prevents duplicate wildcard GET routes from replacing each other.
 * Never reads public business entities and never grants authorization.
 */
final class DdSectionController extends Controller
{
    public function __invoke(
        string $section,
        Request $request,
        DataDictionaryIdentityResolver $resolver,
        DdPhase3Controller $directory,
        DdOperationsController $operations
    ): Response|RedirectResponse {
        if ($section === 'dashboard') {
            $user = $request->user();
            abort_unless($user instanceof User, 403);
            $actor = $resolver->resolve($user);
            abort_unless($actor !== null, 403);
            if (in_array($actor['role'], ['Engineer', 'Viewer'], true)) {
                return app(DdRoleDashboardController::class)->show($request, $resolver);
            }
        }
        if (in_array($section, ['dashboard', 'users', 'lgus'], true)) {
            return $directory->show($section, $request, $resolver);
        }
        if (in_array($section, ['settings', 'roads', 'projects', 'updates', 'documents'], true)) {
            return $operations->show($section, $request, $resolver);
        }
        abort(404);
    }
}
