<?php

use App\Http\Controllers\OperationsFrontendController;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\Quarterly\PostgresTestCase;

require __DIR__.'/../../vendor/autoload.php';

// Same deterministic fixture and process for before/after; guarded local PG only.
$benchmark = new class('runMeasurements') extends PostgresTestCase
{
    public function runMeasurements(): void
    {
        $this->setUp();
        fwrite(STDERR, 'Benchmark application: '.$this->app->basePath().PHP_EOL);
        $f = $this->fixture('Engineer');
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $forbidden = $this->road();
        $results = [];
        $headers = ['X-Inertia' => 'true', 'X-Inertia-Version' => app(HandleInertiaRequests::class)->version(Request::create('/')), 'Accept' => 'text/html'];
        for ($i = 1; $i <= 1000; $i++) {
            if ($i > 1) {
                $points = [];
                for ($v = 0; $v < 150; $v++) {
                    $points[] = [($i % 2 ? 125.95 : 126.7) + $v * 0.00001, ($i % 2 ? 7.59 : 8.2) + $v * 0.00001];
                }
                $road = DB::table('jairoads_next.road_coverages')->insertGetId(['road_name' => sprintf('Synthetic %04d', $i), 'lgu_id' => $lgu,
                    'kilometers' => 1, 'pavement_type' => 'Concrete', 'state_category' => 'Good', 'created_by' => $f['engineer'], 'geojson' => json_encode(['type' => 'LineString', 'coordinates' => $points])]);
                $project = DB::table('jairoads_next.maintenance_projects')->insertGetId(['project_title' => sprintf('Synthetic %04d', $i), 'road_coverage_id' => $road, 'created_by' => $f['user']->dd_user_account_id]);
            } else {
                $project = $f['project'];
            }
            $record = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData((int) $project, $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
            DB::table('jairoads_next.monthly_updates')->insert(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
            if ($i > 1 && $i <= 400) {
                $year = 2000 + intdiv($i - 1, 4);
                $quarter = 'Q'.(($i - 1) % 4 + 1);
                if (! ($year === 2026 && $quarter === 'Q1')) {
                    $history = $this->recordData($f['project'], $f['engineer'], $quarter, $year);
                    $history['description'] = str_repeat('Synthetic history. ', 120);
                    DB::table('jairoads_next.maintenance_records')->insert($history + ['created_by' => $f['user']->dd_user_account_id]);
                }
            }
            if (! in_array($i, [1, 100, 500, 1000], true)) {
                continue;
            }
            foreach (['road' => '/road-coverages/create', 'record' => '/maintenance-records/create', 'fixed-record' => '/maintenance-projects/'.$f['project'].'/records/create',
                'monthly' => '/monthly-updates/create', 'fixed-monthly' => '/monthly-updates/create?maintenance_id='.$record,
                'project-history' => '/maintenance-projects/'.$f['project']] as $name => $path) {
                // Warm once, then three observations. Response bytes are uncompressed JSON.
                $warm = $this->get('/dd-phase3/ui'.$path, $headers);
                if ($warm->getStatusCode() !== 200) {
                    throw new RuntimeException('Benchmark response: '.$warm->getStatusCode().' '.$warm->getContent());
                }
                $samples = [];
                for ($run = 0; $run < 3; $run++) {
                    DB::enableQueryLog();
                    DB::flushQueryLog();
                    memory_reset_peak_usage();
                    $startMemory = memory_get_usage();
                    $start = hrtime(true);
                    $response = $this->get('/dd-phase3/ui'.$path, $headers);
                    $samples[] = ['bytes' => strlen($response->getContent()), 'queries' => count(DB::getQueryLog()),
                        'milliseconds' => round((hrtime(true) - $start) / 1e6, 3), 'peak_delta_bytes' => max(0, memory_get_peak_usage() - $startMemory)];
                    DB::disableQueryLog();
                }
                $results[] = ['roads' => $i, 'page' => $name, 'samples' => $samples];
            }
            if (method_exists(OperationsFrontendController::class, 'roadReferences')) {
                $samples = [];
                for ($run = 0; $run < 3; $run++) {
                    $cursor = null;
                    $bytes = 0;
                    $queries = 0;
                    $count = 0;
                    $peak = 0;
                    $start = hrtime(true);
                    do {
                        DB::enableQueryLog();
                        DB::flushQueryLog();
                        memory_reset_peak_usage();
                        $memory = memory_get_usage();
                        $response = $this->getJson('/dd-phase3/ui/map/roads?'.http_build_query(['west' => 125.9, 'east' => 126, 'south' => 7.5, 'north' => 7.7, 'after' => $cursor]));
                        if ($response->getStatusCode() !== 200) {
                            throw new RuntimeException('Reference benchmark response: '.$response->getStatusCode());
                        }
                        $data = json_decode($response->getContent(), true, 512, JSON_THROW_ON_ERROR);
                        $bytes += strlen($response->getContent());
                        $queries += count(DB::getQueryLog());
                        $count += count($data['data']);
                        $peak = max($peak, memory_get_peak_usage() - $memory);
                        $cursor = $data['next_cursor'];
                        DB::disableQueryLog();
                    } while ($cursor !== null);
                    $samples[] = ['bytes' => $bytes, 'queries' => $queries, 'milliseconds' => round((hrtime(true) - $start) / 1e6, 3), 'peak_delta_bytes' => $peak, 'visible_roads' => $count];
                }
                $results[] = ['roads' => $i, 'page' => 'references-all-pages', 'samples' => $samples];
            }
        }
        echo json_encode($results, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
    }
};

$benchmark->runMeasurements();
