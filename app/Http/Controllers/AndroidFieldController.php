<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\DuplicateMaintenancePeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        // The field cache includes recent assigned work and the projects and roads
        // it references. Other records remain available from the online workspace.
        $records = $this->records($actor)
            ->when($actor['role'] === 'Engineer', fn ($query) => $query->where('m.managing_engineer_id', $engineer))
            ->orderByDesc('m.updated_at')->orderByDesc('m.id')->limit(101)
            ->select(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.start_date',
                'm.estimated_duration_days', 'm.complete_date', 'm.status', 'm.description'])->selectRaw('m.xmin::text as version')->get();
        $projects = $this->projects($actor, false)->where(function ($query) use ($records, $actor): void {
            $query->whereIn('p.id', $records->take(100)->pluck('project_id'));
            if ($actor['role'] === 'Engineer') {
                $query->orWhere('p.created_by', $actor['account_id']);
            }
        })->orderByDesc('p.updated_at')->orderByDesc('p.id')->limit(151)
            ->select(['p.id', 'p.project_title', 'p.road_coverage_id', 'p.description'])->selectRaw('p.xmin::text as version')->get();
        $roads = DB::table('jairoads_next.road_coverages')->where(function ($query) use ($projects, $engineer): void {
            $query->whereIn('id', $projects->take(150)->pluck('road_coverage_id'));
            if ($engineer !== null) {
                $query->orWhere('created_by', $engineer);
            }
        })->orderByDesc('updated_at')->orderByDesc('id')->limit(201)
            ->select(['id', 'road_name', 'lgu_id', 'kilometers', 'pavement_type', 'state_category', 'updated_at'])
            ->selectRaw('xmin::text as version')
            ->selectRaw('CASE WHEN octet_length(geojson::text) <= 32768 THEN geojson::text END AS geojson')
            ->get();
        $roadIds = $roads->take(200)->pluck('id')->all();
        $visibleProjects = $projects->take(150)->whereIn('road_coverage_id', $roadIds)->values();
        $visibleRecords = $records->take(100)->whereIn('project_id', $visibleProjects->pluck('id')->all())->values();

        return response()->json([
            'accountId' => $actor['account_id'],
            'role' => $actor['role'],
            'engineerId' => $engineer,
            'canWrite' => $canWrite,
            'canSync' => $canWrite && Schema::hasTable(self::RECEIPTS),
            'csrfToken' => $request->session()->token(),
            'truncated' => $visibleRecords->count() < $records->count() || $visibleProjects->count() < $projects->count() || $roads->count() > 200,
            'municipalities' => $this->municipalities($actor),
            'roads' => $roads->take(200)->values()->map(function (\stdClass $road): \stdClass {
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
            'kind' => ['required', 'in:road,project,record,monthly'],
            'id' => ['nullable', 'integer', 'min:1', 'prohibited_if:kind,monthly'],
            'version' => ['nullable', 'required_with:id', Rule::prohibitedIf(! $request->filled('id')), 'string', 'max:64'],
            'fields' => ['required', 'array:road_name,lgu_id,kilometers,pavement_type,state_category,geojson,correction_reason,project_title,road_coverage_id,description,project_id,maintenance_year,quarter,start_date,estimated_duration_days,complete_date,status,maintenance_id,update_month,progress_percentage,summary_of_text_reports'],
        ]);
        abort_unless((int) $data['account_id'] === $actor['account_id'], 403);
        $kind = $data['kind'];
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
                    'monthly' => $this->operations->saveUpdate($request, $this->identities),
                };
                $savedId = $id ?? $request->attributes->getInt('jairoads.field_saved_id');
                abort_unless($savedId > 0, 500);
                $table = match ($kind) {
                    'road' => 'road_coverages',
                    'project' => 'maintenance_projects',
                    'record' => 'maintenance_records',
                    'monthly' => 'monthly_updates',
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
}
