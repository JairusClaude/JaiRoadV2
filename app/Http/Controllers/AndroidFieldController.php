<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\DuplicateMaintenancePeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class AndroidFieldController extends OperationsFrontendController
{
    private const RECEIPTS = 'jairoads_security.android_field_receipts';

    /** @return array{account_id: int, role: string, engineer_id: int|null} */
    private function fieldActor(Request $request): array
    {
        abort_unless(config('jairoads_monthly_updates.android_field_enabled') === true, 404);
        abort_if(self::isPreview($request), 404);

        return $this->actor($request);
    }

    public function workspace(Request $request): JsonResponse
    {
        $actor = $this->fieldActor($request);
        abort_unless(in_array($actor['role'], ['Engineer', 'Viewer'], true), 403);
        $engineer = $actor['engineer_id'];
        $canWrite = $engineer !== null && $actor['role'] === 'Engineer' && $this->writable($actor);
        // Expanded clients use the same authorized read scope as the online directories.
        // Prefer assigned work and retain explicit bounded snapshot limits.
        $expanded = $request->query('profile') === 'expanded';
        $recordLimit = $expanded ? 600 : 100;
        $projectLimit = $expanded ? 700 : 150;
        $roadLimit = $expanded ? 800 : 200;
        $monthlyLimit = $expanded ? 800 : 100;
        $fileLimit = $expanded ? 1000 : 200;
        $records = $this->records($actor)
            ->when(! $expanded && $actor['role'] === 'Engineer', fn ($query) => $query->where('m.managing_engineer_id', $engineer))
            ->when($expanded && $engineer !== null, fn ($query) => $query->orderByRaw('CASE WHEN m.managing_engineer_id = ? THEN 0 ELSE 1 END', [$engineer]))
            ->orderByDesc('m.updated_at')->orderByDesc('m.id')->limit($recordLimit + 1)
            ->select(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.start_date',
                'm.estimated_duration_days', 'm.complete_date', 'm.status', 'm.description', 'm.created_at', 'm.updated_at', 'm.managing_engineer_id', 'e.first_name', 'e.last_name', 'a.username as creator_name'])->selectRaw('m.xmin::text as version')->get();
        $projectIds = $records->take($recordLimit)->pluck('project_id')->unique()->values();
        $projects = $this->projects($actor, false)->when(! $expanded, fn ($outer) => $outer->where(function ($query) use ($projectIds, $actor): void {
            $query->whereIn('p.id', $projectIds);
            if ($actor['role'] === 'Engineer') {
                $query->orWhere('p.created_by', $actor['account_id']);
            }
        }))->when($expanded && $projectIds->isNotEmpty(), fn ($query) => $query->orderByRaw('CASE WHEN p.id IN ('.implode(',', array_fill(0, $projectIds->count(), '?')).') THEN 0 ELSE 1 END', $projectIds->all()))
            ->orderByDesc('p.updated_at')->orderByDesc('p.id')->limit($projectLimit + 1)
            ->select(['p.id', 'p.project_title', 'p.road_coverage_id', 'p.description', 'p.created_at', 'p.updated_at', 'a.username as creator_name'])->selectRaw('p.xmin::text as version')->get();
        $linkedRoads = $projects->take($projectLimit)->pluck('road_coverage_id')->unique()->values();
        $roads = DB::table('jairoads_next.road_coverages')->when(! $expanded, fn ($outer) => $outer->where(function ($query) use ($linkedRoads, $engineer): void {
            $query->whereIn('id', $linkedRoads);
            if ($engineer !== null) {
                $query->orWhere('created_by', $engineer);
            }
        }))->when($expanded && $linkedRoads->isNotEmpty(), fn ($query) => $query->orderByRaw('CASE WHEN id IN ('.implode(',', array_fill(0, $linkedRoads->count(), '?')).') THEN 0 ELSE 1 END', $linkedRoads->all()))
            ->orderByDesc('updated_at')->orderByDesc('id')->limit($roadLimit + 1)
            ->select(['id', 'road_name', 'lgu_id', 'kilometers', 'pavement_type', 'state_category', 'updated_at', 'created_at', 'created_by'])
            ->selectSub(DB::table('jairoads_next.maintenance_projects')->whereColumn('road_coverage_id', 'road_coverages.id')->orderBy('id')->limit(1)->select('id'), 'linked_project_id')
            ->selectRaw('xmin::text as version')
            ->selectRaw('CASE WHEN octet_length(geojson::text) <= 32768 THEN geojson::text END AS geojson')
            ->get();
        $roadIds = $roads->take($roadLimit)->pluck('id')->all();
        $visibleProjects = $projects->take($projectLimit)->whereIn('road_coverage_id', $roadIds)->values();
        $visibleRecords = $records->take($recordLimit)->whereIn('project_id', $visibleProjects->pluck('id')->all())->values();

        // File metadata is scoped to the same authorized record snapshot; no
        // private object paths, keys or signed URLs are sent to the device.
        $recordIds = $visibleRecords->pluck('id')->all();
        $monthly = Schema::hasTable('jairoads_next.monthly_updates')
            ? DB::table('jairoads_next.monthly_updates')->whereIn('maintenance_id', $recordIds)
                ->orderByDesc('id')->limit($monthlyLimit + 1)->select(['id', 'maintenance_id', 'update_month', 'progress_percentage', 'summary_of_text_reports', 'created_at', 'updated_at'])->selectRaw('xmin::text as version')->get()
            : collect();
        $monthlyTruncated = $monthly->count() > $monthlyLimit;
        $monthly = $monthly->take($monthlyLimit)->values();
        $files = collect();
        if (Schema::hasTable('jairoads_next.maintenance_documents')) {
            $files = $this->documentQuery($actor)->whereIn('d.maintenance_id', $recordIds)
                ->orderByDesc('d.id')->limit($fileLimit + 1)->selectRaw('d.xmin::text as field_version')->get()->map(fn (\stdClass $d): array => [
                    'kind' => 'document', 'id' => (int) $d->id, 'record' => (int) $d->maintenance_id,
                    'name' => (string) $d->file_name, 'title' => (string) $d->document_title,
                    'version' => (string) $d->updated_at, 'rowVersion' => (string) $d->field_version, 'available' => $d->file_path !== '' && $this->documents->configured(),
                    'description' => $d->description, 'uploadedAt' => (string) $d->uploaded_at, 'uploader' => (string) $d->uploader_name,
                ]);
        }
        $fileTruncated = $files->count() > $fileLimit;
        $files = $files->take($fileLimit);
        if (Schema::hasTable('jairoads_next.media') && $monthly->isNotEmpty()) {
            $photos = DB::table('jairoads_next.media as m')->join('jairoads_next.monthly_updates as u', 'u.id', '=', 'm.monthly_update_id')
                ->whereIn('u.id', $monthly->pluck('id'))->whereIn('m.file_type', ['image/jpeg', 'image/png', 'image/webp'])
                ->orderByDesc('m.id')->limit($fileLimit + 1)->get(['m.id', 'm.file_name', 'm.created_at', 'm.file_type', 'm.monthly_update_id', 'u.maintenance_id'])
                ->map(fn (\stdClass $p): array => [
                    'kind' => 'media', 'id' => (int) $p->id, 'record' => (int) $p->maintenance_id,
                    'name' => (string) $p->file_name, 'title' => (string) $p->file_name,
                    'version' => (string) $p->created_at, 'available' => $this->media->configured(),
                    'parent' => (int) $p->monthly_update_id, 'mime' => (string) $p->file_type,
                ]);
            $fileTruncated = $fileTruncated || $photos->count() > $fileLimit;
            $files = $files->concat($photos->take($fileLimit));
        }

        return response()->json([
            'fileSync' => true,
            'documentEdit' => true,
            'monthly' => $monthly,
            'files' => $files->values(),
            'accountId' => $actor['account_id'],
            'role' => $actor['role'],
            'engineerId' => $engineer,
            'canWrite' => $canWrite,
            'canSync' => $canWrite && Schema::hasTable(self::RECEIPTS),
            'csrfToken' => $request->session()->token(),
            'truncated' => $visibleRecords->count() < $records->count() || $visibleProjects->count() < $projects->count() || $roads->count() > $roadLimit || $monthlyTruncated || $fileTruncated,
            'municipalities' => DB::table('jairoads_next.lgus')->orderBy('municipality_name')->get(['id', 'municipality_name', 'province', 'region', 'mayor_first_name', 'mayor_middle_name', 'mayor_last_name']),
            'lguAssignments' => DB::table('jairoads_next.engineer_lgus as el')->join('jairoads_next.engineers as e', 'e.id', '=', 'el.engineer_id')
                ->orderBy('el.lgu_id')->orderBy('e.id')->limit(2001)->get(['el.lgu_id', 'e.id as engineer_id', 'e.first_name', 'e.last_name', 'e.rank', 'el.is_active']),
            'roads' => $roads->take($roadLimit)->values()->map(function (\stdClass $road): \stdClass {
                $road->geojson = $road->geojson === null ? null : json_decode($road->geojson, true, 64);

                return $road;
            }),
            'projects' => $visibleProjects,
            'records' => $visibleRecords,
        ])->header('Cache-Control', 'private, no-store');
    }

    public function submit(Request $request): JsonResponse
    {
        $actor = $this->fieldActor($request);
        abort_unless($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null, 403);
        abort_unless(Schema::hasTable(self::RECEIPTS), 503, 'Field synchronization is unavailable.');
        $data = $request->validate([
            'account_id' => ['required', 'integer', 'min:1'],
            'operation_id' => ['required', 'uuid'],
            'kind' => ['required', 'in:road,project,record,monthly,document'],
            'id' => ['nullable', 'required_if:kind,document', 'integer', 'min:1'],
            'version' => ['nullable', 'required_with:id', Rule::prohibitedIf(! $request->filled('id')), 'string', 'max:64'],
            'fields' => ['required', 'array:road_name,lgu_id,kilometers,pavement_type,state_category,geojson,correction_reason,project_title,road_coverage_id,description,project_id,maintenance_year,quarter,start_date,estimated_duration_days,complete_date,status,maintenance_id,update_month,progress_percentage,summary_of_text_reports,document_title'],
        ]);
        abort_unless((int) $data['account_id'] === $actor['account_id'], 403);
        $kind = (string) $data['kind'];
        $id = isset($data['id']) ? (int) $data['id'] : null;
        $fields = $data['fields'];
        if ($kind === 'record') {
            $fields['managing_engineer_id'] = $actor['engineer_id'];
        }
        $fingerprint = hash('sha256', json_encode([$kind, $id, $data['version'] ?? null, $fields], JSON_THROW_ON_ERROR));

        try {
            $receipt = DB::transaction(function () use ($request, $actor, $data, $kind, $id, $fields, $fingerprint): array {
                $key = strtolower($data['operation_id']);
                DB::select('select pg_advisory_xact_lock(hashtextextended(?, 0))', ['jairoads-field:'.$actor['account_id'].':'.$key]);
                abort_unless($this->actor($request) === $actor, 403);
                $prior = DB::table(self::RECEIPTS)->where('account_id', $actor['account_id'])->where('operation_id', $key)->first();
                if ($prior !== null) {
                    abort_unless(hash_equals($prior->fingerprint, $fingerprint), 409, 'This local operation has different saved changes.');

                    return ['id' => (int) $prior->entity_id, 'version' => $prior->entity_version];
                }
                // Each existing write handler locks the appropriate business rows
                // and enforces its normal validation, authorization and audit.
                $request->replace($fields);
                $request->attributes->set('jairoads.field_write', true);
                $request->attributes->set('jairoads.field_version', $data['version'] ?? null);
                match ($kind) {
                    'road' => $this->operations->saveRoad($request, $this->identities, $id),
                    'project' => $this->operations->saveProject($request, $this->identities, $id),
                    'record' => $this->operations->saveRecord($request, $this->identities, $id),
                    'monthly' => $this->operations->saveUpdate($request, $this->identities, $id),
                    'document' => $this->operations->updateDocument($request, $this->identities, $id ?? throw ValidationException::withMessages(['id' => 'Existing document required.'])),
                    default => throw ValidationException::withMessages(['kind' => 'Unknown field operation.']),
                };
                $savedId = $id ?? $request->attributes->getInt('jairoads.field_saved_id');
                abort_unless($savedId > 0, 500);
                $table = match ($kind) {
                    'road' => 'road_coverages',
                    'project' => 'maintenance_projects',
                    'record' => 'maintenance_records',
                    'monthly' => 'monthly_updates',
                    'document' => 'maintenance_documents',
                };
                $version = DB::table('jairoads_next.'.$table)->where('id', $savedId)->selectRaw('xmin::text as version')->first()?->version;
                abort_unless(is_string($version), 500);
                DB::table(self::RECEIPTS)->insert([
                    'account_id' => $actor['account_id'], 'operation_id' => $key,
                    'fingerprint' => $fingerprint, 'entity_id' => $savedId, 'entity_version' => $version,
                ]);

                return ['id' => $savedId, 'version' => $version];
            });
        } catch (DuplicateMaintenancePeriod) {
            throw ValidationException::withMessages(['quarter' => 'This project already has a record for that year and quarter.']);
        }

        return response()->json(['operationId' => strtolower($data['operation_id'])] + $receipt)
            ->header('Cache-Control', 'private, no-store');
    }

    /** @phpstan-impure */
    private function attachmentReceipt(int $account, string $key): ?\stdClass
    {
        return DB::table(self::RECEIPTS)->where('account_id', $account)->where('operation_id', $key)->first();
    }

    /** Upload a queued file through the existing private-storage and audit path.
     * The receipt is committed with the metadata, not before Storage confirms.
     */
    public function submitAttachment(Request $request): JsonResponse
    {
        $actor = $this->fieldActor($request);
        abort_unless($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null, 403);
        abort_unless(Schema::hasTable(self::RECEIPTS), 503, 'Field synchronization is unavailable.');
        $v = $request->validate([
            'account_id' => ['required', 'integer', 'min:1'],
            'operation_id' => ['required', 'uuid'],
            'kind' => ['required', 'in:document,media'],
            'parent_id' => ['required', 'integer', 'min:1'],
            'document_title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'file' => ['required', 'file', 'max:20480'],
        ]);
        abort_unless((int) $v['account_id'] === $actor['account_id'], 403);
        $file = $request->file('file');
        abort_unless($file instanceof UploadedFile, 422);
        $hash = hash_file('sha256', $file->getRealPath());
        abort_unless(is_string($hash), 422);
        $key = strtolower($v['operation_id']);
        $fingerprint = hash('sha256', json_encode([
            'attachment', $v['kind'], (int) $v['parent_id'], $v['document_title'] ?? null,
            $v['description'] ?? null, $file->getClientOriginalName(), $hash,
        ], JSON_THROW_ON_ERROR));
        $answer = function (\stdClass $row) use ($fingerprint, $key): JsonResponse {
            abort_unless(hash_equals($row->fingerprint, $fingerprint), 409, 'This saved file operation has different content.');

            return response()->json(['operationId' => $key, 'id' => (int) $row->entity_id, 'version' => $row->entity_version])
                ->header('Cache-Control', 'private, no-store');
        };
        if (($prior = $this->attachmentReceipt($actor['account_id'], $key)) !== null) {
            return $answer($prior);
        }

        $request->attributes->set('jairoads.field_attachment_receipt', [
            'account_id' => $actor['account_id'], 'operation_id' => $key, 'fingerprint' => $fingerprint,
        ]);
        $request->merge([
            'maintenance_id' => $v['kind'] === 'document' ? (int) $v['parent_id'] : null,
            'monthly_update_id' => $v['kind'] === 'media' ? (int) $v['parent_id'] : null,
        ]);
        try {
            if ($v['kind'] === 'document') {
                $this->operations->uploadDocument($request, $this->identities, $this->documents);
            } else {
                $this->operations->uploadMedia($request, $this->identities, $this->media);
            }
        } catch (\Throwable $error) {
            // A concurrent or interrupted request may already have committed.
            if (($prior = $this->attachmentReceipt($actor['account_id'], $key)) !== null) {
                return $answer($prior);
            }
            throw $error;
        }
        $saved = $this->attachmentReceipt($actor['account_id'], $key);
        abort_unless($saved !== null, 503, 'The file receipt was not confirmed.');

        return $answer($saved);
    }
}
