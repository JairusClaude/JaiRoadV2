<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Http\Controllers\MonthlyUpdatePageController;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class MonthlyUpdatePageRoutingTest extends TestCase
{
    public function test_monthly_update_page_routes_keep_their_existing_contract(): void
    {
        $expected = [
            'jairoads.ui.updates.index' => ['GET', 'workspace/ui/monthly-updates', 'updateIndex'],
            'jairoads.ui.updates.create' => ['GET', 'workspace/ui/monthly-updates/create', 'updateForm'],
            'jairoads.ui.updates.submission-outcome' => ['GET', 'workspace/ui/monthly-updates/submission-outcome', 'submissionOutcome'],
            'jairoads.ui.updates.show' => ['GET', 'workspace/ui/monthly-updates/{id}', 'updateShow'],
            'jairoads.ui.updates.edit' => ['GET', 'workspace/ui/monthly-updates/{id}/edit', 'updateForm'],
            'jairoads.ui.updates.store' => ['POST', 'workspace/ui/monthly-updates', 'saveUpdate'],
            'jairoads.ui.updates.update' => ['PUT', 'workspace/ui/monthly-updates/{id}', 'saveUpdate'],
            'jairoads.ui.updates.media' => ['POST', 'workspace/ui/monthly-updates/{id}/media', 'uploadMedia'],
        ];

        foreach ($expected as $name => [$verb, $uri, $method]) {
            $route = Route::getRoutes()->getByName($name);
            $this->assertNotNull($route, "Missing named route: {$name}");
            $this->assertSame($uri, $route->uri(), $name);
            $this->assertContains($verb, $route->methods(), $name);
            $this->assertSame(MonthlyUpdatePageController::class.'@'.$method, $route->getActionName(), $name);
            $this->assertContains('auth', $route->gatherMiddleware(), $name);
            if ($name === 'jairoads.ui.updates.media') {
                $this->assertContains('throttle:8,1,jr-updates-media-', $route->gatherMiddleware(), $name);
            }
        }
    }
}
