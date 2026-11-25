<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Http\Controllers\MaintenanceDocumentPageController;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class MaintenanceDocumentPageRoutingTest extends TestCase
{
    public function test_maintenance_document_page_routes_keep_existing_contract(): void
    {
        $expected = [
            'jairoads.ui.documents.index' => ['GET', 'workspace/ui/maintenance-documents', 'documentIndex', null],
            'jairoads.ui.documents.create' => ['GET', 'workspace/ui/maintenance-documents/create', 'documentForm', null],
            'jairoads.ui.documents.show' => ['GET', 'workspace/ui/maintenance-documents/{id}', 'documentShow', null],
            'jairoads.ui.documents.edit' => ['GET', 'workspace/ui/maintenance-documents/{id}/edit', 'documentForm', null],
            'jairoads.ui.documents.store' => ['POST', 'workspace/ui/maintenance-documents', 'saveDocument', 'throttle:8,1,jr-documents-store-'],
            'jairoads.ui.documents.update' => ['PUT', 'workspace/ui/maintenance-documents/{id}', 'saveDocument', 'throttle:10,1,jr-documents-update-'],
        ];

        foreach ($expected as $name => [$verb, $uri, $method, $throttle]) {
            $route = Route::getRoutes()->getByName($name);
            $this->assertNotNull($route, "Missing named route: {$name}");
            $this->assertSame($uri, $route->uri(), $name);
            $this->assertContains($verb, $route->methods(), $name);
            $this->assertSame(MaintenanceDocumentPageController::class.'@'.$method, $route->getActionName(), $name);
            $this->assertContains('auth', $route->gatherMiddleware(), $name);
            if ($throttle !== null) {
                $this->assertContains($throttle, $route->gatherMiddleware(), $name);
            }
        }
    }
}
