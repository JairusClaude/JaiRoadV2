<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Response;

/**
 * Dispatches one approved canonical section to its individually authorized
 * controller. Prevents duplicate wildcard GET routes from replacing each other.
 * Never reads public business entities and never grants authorization.
 */
final class SectionController extends Controller
{
    public function __invoke(
        string $section,
        Request $request,
        AccountIdentityResolver $resolver,
        DirectoryController $directory,
        OperationsController $operations
    ): Response|RedirectResponse {
        if (OperationsFrontendController::isPreview($request)) {
            return match ($section) {
                'lgus' => redirect('/workspace/ui/lgus'),
                'roads' => redirect('/workspace/ui/road-coverages'),
                'projects' => redirect('/workspace/ui/maintenance-projects'),
                'updates' => redirect('/workspace/ui/monthly-updates'),
                'documents' => redirect('/workspace/ui/maintenance-documents'),
                default => redirect('/workspace/ui/road-coverages'),
            };
        }

        if ($section === 'dashboard') {
            $user = $request->user();
            abort_unless($user instanceof User, 403);
            $actor = $resolver->resolve($user);
            abort_unless($actor !== null, 403);
            if (in_array($actor['role'], ['Engineer', 'Viewer'], true)) {
                return app(RoleLandingController::class)->show($request, $resolver);
            }
        }
        if (in_array($section, ['dashboard', 'users', 'lgus'], true)) {
            return $directory->show($section, $request, $resolver);
        }
        // Ordinary directory aliases use the same paginated controllers as the sidebar.
        // Keep explicitly requested older project forms/details working during cutover.
        if ($section === 'settings' || ($section === 'projects' && in_array($request->query('view'), ['create', 'show', 'edit'], true))) {
            return $operations->show($section, $request, $resolver);
        }
        return match ($section) {
            'roads' => app(RoadCoveragePageController::class)->roadIndex($request),
            'projects' => app(MaintenanceProjectPageController::class)->projectIndex($request),
            'updates' => app(MonthlyUpdatePageController::class)->updateIndex($request),
            'documents' => app(MaintenanceDocumentPageController::class)->documentIndex($request),
            default => abort(404),
        };
    }
}
