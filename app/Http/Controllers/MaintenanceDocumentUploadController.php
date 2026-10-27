<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MaintenanceDocument;
use App\Models\MaintenanceRecord;
use App\Models\User;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Throwable;

/** Scoped live uploads; legacy maintenance-documents resource routes remain fail-closed. */
class MaintenanceDocumentUploadController extends Controller
{
    public function store(Request $request, VerifiedProjectAccount $accounts, PrivateSupabaseStorage $storage): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $account = $accounts->require($user);
        Gate::authorize('create', MaintenanceDocument::class);

        abort_unless(Schema::hasTable('maintenance_documents'), 503, 'Deploy the MaintenanceDocument table first.');
        abort_unless($storage->configured(), 503, 'Configure private Supabase Storage first.');

        $validated = $request->validate([
            'maintenance_id' => ['required', 'integer', 'exists:maintenance_records,id'],
            'document_title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'file' => ['required', 'file', 'mimes:pdf,docx,xlsx,pptx', 'max:10240'],
        ]);

        $record = MaintenanceRecord::query()->findOrFail((int) $validated['maintenance_id']);
        Gate::authorize('createForRecord', [MaintenanceDocument::class, $record]);

        $file = $request->file('file');
        if (! $file instanceof UploadedFile) {
            throw ValidationException::withMessages(['file' => 'A document file is required.']);
        }
        $extension = strtolower($file->getClientOriginalExtension());
        if (! in_array($extension, ['pdf', 'docx', 'xlsx', 'pptx'], true)) {
            throw ValidationException::withMessages(['file' => 'Only PDF, DOCX, XLSX and PPTX are supported.']);
        }
        $name = basename(str_replace('\\', '/', $file->getClientOriginalName()));
        if ($name === '' || strlen($name) > 255) {
            throw ValidationException::withMessages(['file' => 'Use a filename shorter than 256 bytes.']);
        }
        $path = 'maintenance-records/'.$record->getKey().'/'.Str::uuid().'.'.$extension;
        $stored = false;

        try {
            $storage->upload($file, $path);
            $stored = true;
            DB::transaction(function () use ($record, $validated, $name, $path, $account): void {
                $now = now();
                $id = DB::table('maintenance_documents')->insertGetId([
                    'maintenance_id' => $record->getKey(),
                    'document_title' => $validated['document_title'],
                    'description' => $validated['description'] ?? null,
                    'file_name' => $name,
                    'file_path' => $path,
                    'uploaded_by' => $account->getKey(),
                    'uploaded_at' => $now,
                    'updated_at' => $now,
                ]);
                DB::table('audit_logs')->insert([
                    'user_id' => $account->getKey(),
                    'actor_identifier' => (string) $account->username,
                    'action' => 'CREATE',
                    'entity_type' => 'MaintenanceDocument',
                    'entity_id' => $id,
                    'description' => 'Created a formal maintenance document.',
                    'old_value' => null,
                    'new_value' => json_encode([
                        'id' => $id,
                        'maintenance_id' => $record->getKey(),
                        'document_title' => $validated['document_title'],
                        'file_name' => $name,
                    ], JSON_THROW_ON_ERROR),
                    'recipient_user_id' => null,
                    // Physical audit_logs.notification_message is currently NOT NULL.
                    'notification_message' => '',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
        } catch (Throwable $error) {
            // TEMPORARY: record only which stage failed and the safe HTTP status (if present).
            $safeStorageStatus = null;
            if (preg_match('/^Private document upload failed \(HTTP ([0-9]{3})\)\.$/', $error->getMessage(), $httpMatch) === 1) {
                $safeStorageStatus = (int) $httpMatch[1];
            }
            Log::error('Maintenance document creation failed', [
                'exception_type' => get_class($error),
                'failure_stage' => $stored ? 'database_or_audit' : 'storage_upload',
                'storage_http_status' => $safeStorageStatus,
                'maintenance_record_id' => $record->getKey(),
            ]);
            if ($stored) {
                try {
                    $storage->removeAfterFailure($path);
                } catch (Throwable $cleanup) {
                    Log::critical('Private document upload orphan cleanup failed', [
                        'maintenance_record_id' => $record->getKey(),
                        'object_path' => $path,
                        'exception_type' => get_class($cleanup),
                    ]);
                }
            }
            throw ValidationException::withMessages([
                'file' => 'The document could not be saved. No document record was created; contact your administrator if this continues.',
            ]);
        }

        return to_route('project-documents.preview')->with('message', 'Maintenance document uploaded successfully.');
    }

    public function download(int $document, Request $request, VerifiedProjectAccount $accounts, PrivateSupabaseStorage $storage): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $accounts->require($user);
        abort_unless(Schema::hasTable('maintenance_documents'), 404);
        $model = MaintenanceDocument::query()->findOrFail($document);
        Gate::authorize('view', $model);
        abort_unless($storage->configured(), 503);

        try {
            $remote = $storage->fetch((string) $model->file_path);
        } catch (Throwable) {
            abort(404, 'This private file is not currently available.');
        }
        $filename = basename(str_replace('\\', '/', (string) $model->file_name));
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $types = [
            'pdf' => 'application/pdf',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ];
        $type = $types[$extension] ?? 'application/octet-stream';
        $disposition = HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $filename, 'document.'.$extension);

        return response($remote->body(), 200, [
            'Content-Type' => $type,
            'Content-Disposition' => $disposition,
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
