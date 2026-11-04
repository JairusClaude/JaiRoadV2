<?php

declare(strict_types=1);

namespace App\Services\Documents;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/** Private Supabase Storage REST calls made only on the Laravel server. */
class PrivateSupabaseStorage
{
    public function configured(): bool
    {
        return $this->baseUrl() !== '' && $this->token() !== '';
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('jairoads_documents.supabase_url', ''), '/');
    }

    private function token(): string
    {
        return (string) config('jairoads_documents.service_role_key', '');
    }

    private function objectUrl(string $path, bool $authenticated = false): string
    {
        $bucket = (string) config('jairoads_documents.bucket', 'jairoads-maintenance-documents');
        if (! preg_match('/^[a-zA-Z0-9_-]+$/D', $bucket) || ! preg_match('#^maintenance-records/[0-9]+/[0-9a-f-]+\.(pdf|docx|xlsx|pptx)$#D', $path)) {
            throw new RuntimeException('Invalid document storage location.');
        }
        $prefix = $authenticated ? 'object/authenticated' : 'object';

        return $this->baseUrl().'/storage/v1/'.$prefix.'/'.$bucket.'/'.$path;
    }

    /** @return PendingRequest */
    private function request()
    {
        if (! $this->configured()) {
            throw new RuntimeException('Private Supabase Storage is not configured.');
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
            Log::warning('JaiROADS Supabase Storage upload rejection', [
                'http_status' => $response->status(),
                'storage_error_code' => $code,
                'upload_mime_type' => preg_match('#^[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+$#', $mime) === 1 ? $mime : 'unavailable',
            ]);
            throw new RuntimeException('Private document upload failed (HTTP '.$response->status().').');
        }
    }

    /** Returns a response without sharing storage credentials or object URLs with the browser. */
    public function fetch(string $path): Response
    {
        $response = $this->request()->get($this->objectUrl($path, true));
        if (! $response->successful()) {
            throw new RuntimeException('Document is unavailable from private storage.');
        }

        return $response;
    }

    /** @return array{origin:string,bucket:string} */
    public function permanentLocation(string $path, int $parentId): array
    {
        $this->objectUrl($path); // Existing exact-object allowlist; never a folder/prefix.
        if (! str_starts_with($path, 'maintenance-records/'.$parentId.'/')) {
            throw new RuntimeException('Invalid permanent deletion target.');
        }

        return ['origin' => $this->baseUrl(), 'bucket' => (string) config('jairoads_documents.bucket')];
    }

    /** Delete one verified object; credentials/URLs never leave this service. */
    public function removePermanently(string $path): void
    {
        $parts = explode('.', $this->token());
        $claims = count($parts) === 3 ? json_decode((string) base64_decode(strtr($parts[1], '-_', '+/')), true) : null;
        $localMock = app()->environment('testing') && getenv('JAIROADS_SCRATCH_APPROVAL') === 'DISPOSABLE_LOCAL_ONLY'
            && in_array(parse_url($this->baseUrl(), PHP_URL_HOST), ['127.0.0.1', 'localhost'], true);
        if (! str_starts_with($this->token(), 'sb_secret_') && (! is_array($claims) || ($claims['role'] ?? null) !== 'service_role') && ! $localMock) {
            throw new RuntimeException('A server-only Storage credential is required for permanent removal.');
        }
        $objectUrl = $this->objectUrl($path);
        try {
            // Versioned buckets can create a delete marker while retaining bytes.
            // Never report that as permanent removal; no version-purge policy is
            // authorized here. Legacy servers omit the versioning column.
            $bucket = (string) config('jairoads_documents.bucket');
            $details = $this->request()->get($this->baseUrl().'/storage/v1/bucket/'.$bucket);
            $metadata = $details->json();
            if (! $details->successful() || ! is_array($metadata) || ($metadata['id'] ?? null) !== $bucket
                || ($metadata['public'] ?? null) !== false
                || (array_key_exists('versioning_status', $metadata) && $metadata['versioning_status'] !== 'DISABLED')) {
                throw new RuntimeException('Private unversioned bucket removal could not be verified.');
            }
            $response = $this->request()->delete($objectUrl);
        } catch (ConnectionException) {
            throw new RuntimeException('Private object removal is not confirmed.');
        }
        $code = $response->json('code');
        // A missing bucket/tenant/route, generic 404 or denial is NOT proof that
        // this object was removed. Only the provider's exact object-missing code.
        if (! (($response->status() === 200 && $response->json('message') === 'Successfully deleted') || $response->status() === 204 || ($response->status() === 404 && $code === 'NoSuchKey'))) {
            throw new RuntimeException('Private object removal is not confirmed.');
        }
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
