<?php

declare(strict_types=1);

namespace App\Services\MonthlyUpdates;

use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/** Private monthly-media Supabase Storage REST calls made only on the Laravel server. */
class PrivateMonthlyMediaStorage
{
    public function configured(): bool
    {
        return $this->baseUrl() !== '' && $this->token() !== '';
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('jairoads_monthly_updates.supabase_url', ''), '/');
    }

    private function token(): string
    {
        return (string) config('jairoads_monthly_updates.service_role_key', '');
    }

    private function objectUrl(string $path, bool $authenticated = false): string
    {
        $bucket = (string) config('jairoads_monthly_updates.bucket', 'jairoads-monthly-media');
        if (! preg_match('/^[a-zA-Z0-9_-]+$/', $bucket) || ! preg_match('#^monthly-updates/[0-9]+/[0-9a-f-]+\.(jpg|png|webp|mp4|webm)$#', $path)) {
            throw new RuntimeException('Invalid monthly-media storage location.');
        }
        $prefix = $authenticated ? 'object/authenticated' : 'object';
        return $this->baseUrl().'/storage/v1/'.$prefix.'/'.$bucket.'/'.$path;
    }

    /** @return \Illuminate\Http\Client\PendingRequest */
    private function request()
    {
        if (! $this->configured()) {
            throw new RuntimeException('Monthly media Supabase Storage is not configured.');
        }
        $request = Http::timeout(30)->withHeaders(['apikey' => $this->token()]);
        // New sb_secret_* keys are opaque, not JWTs. Bearer auth is for legacy service_role JWTs only.
        if (! str_starts_with($this->token(), 'sb_secret_')) {
            $request = $request->withToken($this->token());
        }
        return $request;
    }

    public function upload(UploadedFile $file, string $path): void
    {
        $mime = (string) ($file->getMimeType() ?: 'application/octet-stream');
        $bytes = file_get_contents($file->getRealPath());
        if ($bytes === false) {
            throw new RuntimeException('Unable to read the uploaded file.');
        }
        $response = $this->request()->withHeaders(['x-upsert' => 'false'])
            ->withBody($bytes, $mime)->post($this->objectUrl($path));
        if (! $response->successful()) {
            // TEMPORARY: capture only a safe Storage error identifier; never log its response body.
            $code = $response->json('code') ?? $response->json('errorCode') ?? $response->json('error');
            if (! is_string($code) || preg_match('/^[A-Za-z][A-Za-z0-9_]{0,63}$/D', $code) !== 1) {
                $code = 'unavailable';
            }
            Log::warning('JaiROADS monthly-media Storage rejection', [
                'http_status' => $response->status(),
                'storage_error_code' => $code,
                'media_mime_type' => preg_match('#^[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+$#', $mime) === 1 ? $mime : 'unavailable',
            ]);
            throw new RuntimeException('Private monthly-media upload failed (HTTP '.$response->status().').');
        }
    }

    /** Returns a response without sharing storage credentials or object URLs with the browser. */
    public function fetch(string $path): Response
    {
        $response = $this->request()->get($this->objectUrl($path, true));
        if (! $response->successful()) {
            throw new RuntimeException('Media is unavailable from private storage.');
        }
        return $response;
    }

    public function removeAfterFailure(string $path): void
    {
        // Best-effort compensation when metadata/audit transaction fails.
        $response = $this->request()->delete($this->objectUrl($path));
        if (! $response->successful()) {
            throw new RuntimeException('Unable to clean up the orphaned private object.');
        }
    }
}
