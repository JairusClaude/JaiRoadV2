<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\MaintenanceRecord;
use App\Models\MonthlyUpdate;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use App\Services\MonthlyUpdates\MonthlyUpdatesReadiness;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Throwable;

/** New explicit preview save endpoint. Old resource CRUD stays fail-closed. */
class MonthlyUpdateSubmissionController extends Controller
{
    private const MIME_EXT = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
        'video/mp4' => 'mp4', 'video/webm' => 'webm',
    ];

    public function store(Request $request, VerifiedProjectAccount $accounts, MonthlyUpdatesReadiness $readiness, PrivateMonthlyMediaStorage $storage): RedirectResponse
    {
        abort_unless($readiness->canWrite(), 503, 'Monthly Updates writes are not enabled or the database schema is incomplete.');
        abort_unless($storage->configured(), 503, 'Private monthly-media Storage is not configured.');
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $account = $accounts->require($user);
        Gate::authorize('create', MonthlyUpdate::class);

        $data = $request->validate([
            'maintenance_id' => ['required', 'integer', 'exists:maintenance_records,id'],
            'update_month' => ['required', 'string', 'regex:/\A[0-9]{4}-(0[1-9]|1[0-2])\z/'],
            'progress_percentage' => ['required', 'numeric', 'decimal:0,2', 'between:0,100'],
            'summary_of_text_reports' => ['nullable', 'string', 'max:5000'],
            'files' => ['sometimes', 'array', 'max:5'],
            'files.*' => ['required', 'file', 'max:20480'],
        ]);
        $record = MaintenanceRecord::query()->findOrFail((int) $data['maintenance_id']);
        Gate::authorize('createForRecord', [MonthlyUpdate::class, $record]);
        if (DB::table('monthly_updates')->where('maintenance_id', $record->getKey())
            ->where('update_month', $data['update_month'])->exists()) {
            throw ValidationException::withMessages(['update_month' => 'A report already exists for this record and month.']);
        }
        $files = $request->file('files', []);
        $files = is_array($files) ? $files : [];
        foreach ($files as $file) {
            $mime = (string) $file->getMimeType();
            if (! isset(self::MIME_EXT[$mime])) {
                throw ValidationException::withMessages(['files' => 'Only JPEG, PNG, WEBP, MP4 and WEBM evidence is permitted.']);
            }
            $filename = basename(str_replace('\\', '/', $file->getClientOriginalName()));
            if ($filename === '' || strlen($filename) > 255) {
                throw ValidationException::withMessages(['files' => 'File names must be under 256 bytes.']);
            }
        }

        $uploadedPaths = [];
        try {
            DB::transaction(function () use ($account, $data, $files, $storage, &$uploadedPaths): void {
                $now = now();
                $id = DB::table('monthly_updates')->insertGetId([
                    'maintenance_id' => (int) $data['maintenance_id'],
                    'update_month' => $data['update_month'],
                    'progress_percentage' => $data['progress_percentage'],
                    'summary_of_text_reports' => $data['summary_of_text_reports'] ?? null,
                    'created_by' => $account->getKey(), 'created_at' => $now, 'updated_at' => $now,
                ]);
                $this->audit((int) $account->getKey(), (string) $account->username,
                    'MonthlyUpdate', (int) $id, 'Created a record-linked monthly report.',
                    ['id' => (int) $id, 'maintenance_id' => (int) $data['maintenance_id'], 'update_month' => $data['update_month']]);

                foreach ($files as $file) {
                    $mime = (string) $file->getMimeType();
                    $path = 'monthly-updates/'.$id.'/'.Str::uuid().'.'.self::MIME_EXT[$mime];
                    // Upload before inserting metadata. Compensate if DB/audit subsequently fails.
                    $storage->upload($file, $path);
                    $uploadedPaths[] = $path;
                    $filename = basename(str_replace('\\', '/', $file->getClientOriginalName()));
                    $mediaId = DB::table('media')->insertGetId([
                        'monthly_updates_id' => $id, 'uploaded_by' => $account->getKey(),
                        'file_name' => $filename, 'file_path' => $path, 'file_type' => $mime,
                        'created_at' => $now, 'updated_at' => $now,
                    ]);
                    $this->audit((int) $account->getKey(), (string) $account->username,
                        'Media', (int) $mediaId, 'Uploaded private monthly evidence.',
                        ['id' => (int) $mediaId, 'monthly_updates_id' => (int) $id, 'file_type' => $mime]);
                }
            });
        } catch (Throwable $error) {
            Log::error('MonthlyUpdate create failed', ['failure_type' => get_class($error), 'maintenance_record_id' => $record->getKey()]);
            foreach ($uploadedPaths as $path) {
                try {
                    $storage->removeAfterFailure($path);
                } catch (Throwable $cleanup) {
                    Log::critical('Monthly evidence cleanup failed', ['path' => $path, 'failure_type' => get_class($cleanup)]);
                }
            }
            throw ValidationException::withMessages(['form' => 'The monthly report could not be saved. No report was committed. Check for a duplicate month or contact the administrator.']);
        }

        return to_route('monthly-updates.preview')->with('message', 'Monthly report saved successfully.');
    }

    public function download(int $media, Request $request, VerifiedProjectAccount $accounts, MonthlyUpdatesReadiness $readiness, PrivateMonthlyMediaStorage $storage): Response
    {
        abort_unless($readiness->schemaReady(), 404);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $accounts->require($user);
        $row = DB::table('media')->where('id', $media)->first();
        abort_unless($row !== null, 404);
        $monthly = MonthlyUpdate::query()->findOrFail((int) $row->monthly_updates_id);
        Gate::authorize('view', $monthly);
        abort_unless($storage->configured(), 503);
        try {
            $remote = $storage->fetch((string) $row->file_path);
        } catch (Throwable) {
            abort(404, 'The private evidence file is unavailable.');
        }
        $name = basename(str_replace('\\', '/', (string) $row->file_name));
        $mime = (string) $row->file_type;
        abort_unless(isset(self::MIME_EXT[$mime]), 404);
        $disposition = HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $name, 'evidence.'.self::MIME_EXT[$mime]);

        return response($remote->body(), 200, [
            'Content-Type' => $mime, 'Content-Disposition' => $disposition,
            'Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Insert system-managed audit records; no secrets, file contents or full summary text.
     *
     * @param  array<string,mixed>  $new
     */
    private function audit(int $accountId, string $username, string $entity, int $id, string $description, array $new): void
    {
        $now = now();
        DB::table('audit_logs')->insert([
            'user_id' => $accountId, 'actor_identifier' => $username, 'action' => 'CREATE',
            'entity_type' => $entity, 'entity_id' => $id, 'description' => $description,
            'old_value' => null, 'new_value' => json_encode($new, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null, 'notification_message' => '',
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }
}
