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
            'jairoads.ui.updates.index' => ['GET', 'dd-phase3/ui/monthly-updates', 'updateIndex'],
            'jairoads.ui.updates.create' => ['GET', 'dd-phase3/ui/monthly-updates/create', 'updateForm'],
            'jairoads.ui.updates.show' => ['GET', 'dd-phase3/ui/monthly-updates/{id}', 'updateShow'],
            'jairoads.ui.updates.edit' => ['GET', 'dd-phase3/ui/monthly-updates/{id}/edit', 'updateForm'],
            'jairoads.ui.updates.store' => ['POST', 'dd-phase3/ui/monthly-updates', 'saveUpdate'],
            'jairoads.ui.updates.update' => ['PUT', 'dd-phase3/ui/monthly-updates/{id}', 'saveUpdate'],
            'jairoads.ui.updates.media' => ['POST', 'dd-phase3/ui/monthly-updates/{id}/media', 'uploadMedia'],
        ];

        foreach ($expected as $name => [$verb, $uri, $method]) {
            $route = Route::getRoutes()->getByName($name);
            $this->assertNotNull($route, "Missing named route: {$name}");
            $this->assertSame($uri, $route->uri(), $name);
            $this->assertContains($verb, $route->methods(), $name);
            $this->assertSame(MonthlyUpdatePageController::class.'@'.$method, $route->getActionName(), $name);
            $this->assertContains('auth', $route->gatherMiddleware(), $name);
            if ($name === 'jairoads.ui.updates.media') {
                $this->assertContains('throttle:8,1', $route->gatherMiddleware(), $name);
            }
        }
    }
}
