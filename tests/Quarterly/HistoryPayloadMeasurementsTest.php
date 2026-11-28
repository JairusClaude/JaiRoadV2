<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class HistoryPayloadMeasurementsTest extends PostgresTestCase
{
    public function test_large_record_history_preserves_bounded_payloads_and_records_measurements(): void
    {
        $f = $this->fixture('Engineer');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->canonical_user_account_id],
        );
        $url = '/workspace/ui/maintenance-projects/'.$f['project'].'/records/'.$record;
        $headers = [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(Request::create('/')),
            'Accept' => 'text/html',
        ];
        $previous = 0;
        $measurements = [];
        $directoryMeasurements = [];
        foreach ([1, 100, 1000] as $size) {
            $reports = [];
            $documents = [];
            for ($i = $previous; $i < $size; $i++) {
                $reports[] = [
                    'maintenance_id' => $record,
                    'update_month' => sprintf('%04d-%02d', 1900 + intdiv($i, 12), $i % 12 + 1),
                    'progress_percentage' => 75,
                    'summary_of_text_reports' => str_repeat('Synthetic report. ', 150),
                    'created_by' => $f['user']->canonical_user_account_id,
                ];
                $documents[] = [
                    'maintenance_id' => $record,
                    'document_title' => 'Synthetic document '.$i,
                    'description' => str_repeat('Synthetic document detail. ', 150),
                    'file_name' => 'fixture.pdf',
                    'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-'.str_pad((string) $i, 12, '0', STR_PAD_LEFT).'.pdf',
                    'uploaded_by' => $f['user']->canonical_user_account_id,
                ];
            }
            foreach (array_chunk($reports, 100) as $chunk) {
                DB::table('jairoads_next.monthly_updates')->insert($chunk);
            }
            foreach (array_chunk($documents, 100) as $chunk) {
                DB::table('jairoads_next.maintenance_documents')->insert($chunk);
            }
            $previous = $size;
            $this->get($url, $headers)->assertOk();
            $samples = [];
            for ($run = 0; $run < 3; $run++) {
                DB::enableQueryLog();
                DB::flushQueryLog();
                memory_reset_peak_usage();
                $memory = memory_get_usage();
                $start = hrtime(true);
                try {
                    $response = $this->get($url, $headers);
                    $samples[] = [
                        'bytes' => strlen((string) $response->getContent()),
                        'queries' => count(DB::getQueryLog()),
                        'milliseconds' => round((hrtime(true) - $start) / 1e6, 3),
                        'peak_delta_bytes' => max(0, memory_get_peak_usage() - $memory),
                    ];
                } finally {
                    DB::disableQueryLog();
                }
                $response->assertOk()->assertJsonCount(min(12, $size), 'props.updates')
                    ->assertJsonCount(min(12, $size), 'props.documents')
                    ->assertJsonPath('props.updatePagination.total', $size)
                    ->assertJsonPath('props.documentPagination.total', $size)
                    ->assertJsonPath('props.checkpointMonths.2', '1900-01')
                    ->assertJsonMissingPath('props.updates.0.summary_of_text_reports')
                    ->assertJsonMissingPath('props.documents.0.description');
            }
            $measurements[] = ['reports_and_documents_each' => $size, 'samples' => $samples];
            foreach ([
                'monthly-updates' => ['updates', 'summary_of_text_reports'],
                'maintenance-documents' => ['documents', 'description'],
            ] as $directory => [$key, $omitted]) {
                $directoryUrl = '/workspace/ui/'.$directory;
                $this->get($directoryUrl, $headers)->assertOk();
                $directorySamples = [];
                for ($run = 0; $run < 3; $run++) {
                    DB::enableQueryLog();
                    DB::flushQueryLog();
                    memory_reset_peak_usage();
                    $memory = memory_get_usage();
                    $start = hrtime(true);
                    try {
                        $response = $this->get($directoryUrl, $headers);
                        $directorySamples[] = [
                            'bytes' => strlen((string) $response->getContent()),
                            'queries' => count(DB::getQueryLog()),
                            'milliseconds' => round((hrtime(true) - $start) / 1e6, 3),
                            'peak_delta_bytes' => max(0, memory_get_peak_usage() - $memory),
                        ];
                    } finally {
                        DB::disableQueryLog();
                    }
                    $response->assertOk()->assertJsonCount(min(12, $size), 'props.'.$key.'.data')
                        ->assertJsonPath('props.'.$key.'.total', $size)
                        ->assertJsonMissingPath('props.'.$key.'.data.0.'.$omitted);
                    $this->assertLessThan(50000, $directorySamples[$run]['bytes']);
                }
                $directoryMeasurements[] = ['directory' => $directory, 'rows' => $size, 'samples' => $directorySamples];
            }
        }

        fwrite(STDERR, 'JAIROADS_HISTORY_MEASUREMENTS '.json_encode($measurements, JSON_THROW_ON_ERROR).PHP_EOL);
        fwrite(STDERR, 'JAIROADS_DIRECTORY_MEASUREMENTS '.json_encode($directoryMeasurements, JSON_THROW_ON_ERROR).PHP_EOL);
    }
}
