<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Http\Controllers\RoadMunicipalityChangeController;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

final class RoadMunicipalityChangeRoutingTest extends TestCase
{
    public function test_municipality_change_routes_preserve_the_canonical_contract(): void
    {
        $expected = [
            'jairoads.dd-phase3.operations.roads.municipality.preview' => [
                'POST', 'dd-phase3/ops/roads/{id}/municipality/preview', 'previewRoadMunicipality',
            ],
            'jairoads.dd-phase3.operations.roads.municipality.confirm' => [
                'POST', 'dd-phase3/ops/roads/{id}/municipality/confirm', 'confirmRoadMunicipality',
            ],
        ];
        foreach ($expected as $name => [$verb, $uri, $method]) {
            $route = Route::getRoutes()->getByName($name);
            $this->assertNotNull($route, 'Missing named route '.$name);
            $this->assertSame($uri, $route->uri(), $name);
            $this->assertContains($verb, $route->methods(), $name);
            $this->assertSame(RoadMunicipalityChangeController::class.'@'.$method, $route->getActionName(), $name);
            $this->assertContains('auth', $route->gatherMiddleware(), $name);
            $this->assertSame('[0-9]+', $route->wheres['id'] ?? null, $name);
        }
    }
}
