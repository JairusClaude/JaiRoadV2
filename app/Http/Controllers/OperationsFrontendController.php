<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\Files\PermanentFileDeletion;
use App\Services\ManagingEngineerEligibility;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use App\Services\RoleAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Canonical read projections for the reviewed frontend. Writes delegate to the
 * verified DD operations; legacy IDs, preview sessions and public business data
 * are never translated into canonical identities.
 *
 * @phpstan-type Actor array{account_id:int,role:string,engineer_id:?int}
 */
class OperationsFrontendController extends Controller
{
    protected const BASE = '/dd-phase3/ui';

    /** @var array<int,bool> */
    private array $writeAccess = [];

    public function __construct(
        protected AccountIdentityResolver $identities,
        protected OperationsController $operations,
        protected ManagingEngineerEligibility $eligibility,
        protected PrivateSupabaseStorage $documents,
        protected PrivateMonthlyMediaStorage $media,
        private PermanentFileDeletion $fileDeletions,
    ) {}

    /** @return Actor */
    protected function actor(Request $request): array
    {
        $login = $request->user();
        abort_unless($login instanceof User && $login->getAttribute('dd_user_account_id') !== null, 403);
        $actor = $this->identities->resolve($login);
        abort_unless($actor !== null, 403, 'Your account is unavailable. Contact your administrator.');

        return $actor;
    }

    /** @param Actor $actor */
    protected function scope(Builder $query, array $actor): Builder
    {
        if ($actor['role'] === 'Engineer') {
            $query->whereIn('rc.lgu_id', DB::table('jairoads_next.engineer_lgus')
                ->select('lgu_id')->where('engineer_id', $actor['engineer_id'])->where('is_active', true));
        }

        return $query;
    }

    /** @param Actor $actor */
    protected function writable(array $actor): bool
    {
        return $this->writeAccess[$actor['account_id']] ??= RoleAccess::managesBusinessData($actor['role'])
            || ($actor['role'] === 'Engineer' && $actor['engineer_id'] !== null
                && DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $actor['engineer_id'])->where('is_active', true)->exists());
    }

    /** @param Actor $actor */
    protected function writer(array $actor): void
    {
        abort_unless($this->writable($actor), 403);
    }

    /** @param Actor $actor
     * @return Collection<int,\stdClass>
     */
    protected function municipalities(array $actor): Collection
    {
        return DB::table('jairoads_next.lgus')->when($actor['role'] === 'Engineer', fn (Builder $q) => $q->whereIn('id',
            DB::table('jairoads_next.engineer_lgus')->select('lgu_id')->where('engineer_id', $actor['engineer_id'])->where('is_active', true)))
            ->orderBy('municipality_name')->get(['id', 'municipality_name']);
    }

    /** @param array<string,mixed> $props */
    protected function render(string $component, Request $request, array $props): Response
    {
        return Inertia::render($component, $props + [
            'canonicalFrontend' => true,
            'jairoadsIdentity' => ['role' => strtolower($this->actor($request)['role'])],
            'status' => $request->session()->get('dd_operations_status'),
        ]);
    }

    /** @param Actor $actor */
    protected function roads(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.road_coverages as rc')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'rc.created_by')
            ->leftJoin('jairoads_next.maintenance_projects as p', 'p.road_coverage_id', '=', 'rc.id'), $actor)
            ->select(['rc.*', 'l.municipality_name', 'e.first_name', 'e.last_name', 'p.id as project_id', 'p.project_title']);
    }

    /** @return array<string,mixed> */
    protected function roadData(\stdClass $row): array
    {
        return [
            'id' => (int) $row->id, 'road_name' => $row->road_name,
            // Frontend response alias only; the canonical column remains lgu_id.
            'lgus_id' => (int) $row->lgu_id, 'lgu' => ['id' => (int) $row->lgu_id, 'municipality_name' => $row->municipality_name],
            'kilometers' => $row->kilometers, 'pavement_type' => $row->pavement_type, 'state_category' => $row->state_category,
            'geojson' => json_decode($row->geojson, true, 512, JSON_THROW_ON_ERROR), 'created_by' => (int) $row->created_by,
            'created_at' => $row->created_at, 'updated_at' => $row->updated_at,
        ];
    }

    /** @param Actor $actor */
    protected function projects(array $actor, bool $geometry = true): Builder
    {
        return $this->scope(DB::table('jairoads_next.maintenance_projects as p')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'p.created_by'), $actor)
            ->select(['p.*', 'rc.road_name', 'rc.lgu_id', 'l.municipality_name', 'a.username as creator_name', ...($geometry ? ['rc.geojson'] : [])])
            ->selectSub(DB::table('jairoads_next.maintenance_records as c')->selectRaw('count(*)')->whereColumn('c.project_id', 'p.id'), 'record_count');
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    protected function projectData(\stdClass $p, array $actor): array
    {
        return ['id' => (int) $p->id, 'project_title' => $p->project_title, 'description' => $p->description,
            'road_coverage_id' => (int) $p->road_coverage_id, 'road_name' => $p->road_name, 'municipality' => $p->municipality_name,
            'created_by' => $p->creator_name, 'created_at' => $p->created_at, 'updated_at' => $p->updated_at,
            'maintenance_records_count' => (int) $p->record_count, 'can_edit' => $this->writable($actor), 'can_delete' => RoleAccess::managesBusinessData($actor['role']) && (int) $p->record_count === 0,
            ...(isset($p->geojson) ? ['geojson' => json_decode($p->geojson, true, 512, JSON_THROW_ON_ERROR)] : [])];
    }

    /** @param Actor $actor */
    protected function projectChoices(array $actor): Builder
    {
        return $this->projects($actor, false)->select(['p.id', 'p.project_title', 'p.road_coverage_id', 'rc.road_name', 'rc.lgu_id', 'l.municipality_name']);
    }

    /** @return array<string,mixed> */
    protected function projectChoiceData(\stdClass $p): array
    {
        return ['id' => (int) $p->id, 'project_title' => $p->project_title, 'municipality' => $p->municipality_name,
            'road_coverage_id' => (int) $p->road_coverage_id, 'road_name' => $p->road_name];
    }

    /** @return array{id:int,project_id:int,year:int,quarter:string,details_url:string} */
    protected function periodChoiceData(\stdClass $r): array
    {
        return ['id' => (int) $r->id, 'project_id' => (int) $r->project_id, 'year' => (int) $r->maintenance_year, 'quarter' => $r->quarter,
            'details_url' => self::BASE.'/maintenance-projects/'.$r->project_id.'/records/'.$r->id];
    }

    /** @param Actor $actor */
    protected function records(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.maintenance_records as m')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->leftJoin('jairoads_next.engineers as e', 'e.id', '=', 'm.managing_engineer_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'm.created_by'), $actor)
            ->select(['m.*', 'p.project_title', 'rc.lgu_id', 'l.municipality_name', 'e.first_name', 'e.last_name', 'a.username as creator_name']);
    }

    /** @param Actor $actor */
    protected function canWriteRecord(\stdClass $row, array $actor): bool
    {
        return $this->writable($actor) && ($actor['role'] !== 'Engineer' || (int) $row->managing_engineer_id === $actor['engineer_id']);
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    protected function recordData(\stdClass $r, array $actor): array
    {
        $url = self::BASE.'/maintenance-projects/'.$r->project_id.'/records/'.$r->id;

        return ['id' => (int) $r->id, 'project_id' => (int) $r->project_id, 'year' => (int) $r->maintenance_year,
            'quarter' => $r->quarter, 'status' => $r->status, 'engineers_id' => $r->managing_engineer_id === null ? null : (int) $r->managing_engineer_id,
            'managing_engineer' => $r->managing_engineer_id === null ? null : ['id' => (int) $r->managing_engineer_id, 'first_name' => $r->first_name, 'last_name' => $r->last_name],
            'start_date' => $r->start_date, 'estimated_duration_days' => (int) $r->estimated_duration_days, 'complete_date' => $r->complete_date,
            'description' => $r->description, 'created_by' => $r->creator_name, 'created_at' => $r->created_at, 'updated_at' => $r->updated_at,
            'details_url' => $url, 'edit_url' => $this->canWriteRecord($r, $actor) ? $url.'/edit' : null, 'delete_url' => null,
            'project' => ['id' => (int) $r->project_id, 'project_title' => $r->project_title, 'municipality' => $r->municipality_name]];
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    protected function historyData(\stdClass $r, array $actor): array
    {
        $url = self::BASE.'/maintenance-projects/'.$r->project_id.'/records/'.$r->id;

        return ['id' => (int) $r->id, 'year' => (int) $r->maintenance_year, 'quarter' => $r->quarter, 'status' => $r->status,
            'engineers_id' => $r->managing_engineer_id === null ? null : (int) $r->managing_engineer_id,
            'managing_engineer' => $r->managing_engineer_id === null ? null : ['id' => (int) $r->managing_engineer_id, 'first_name' => $r->first_name, 'last_name' => $r->last_name],
            'start_date' => $r->start_date, 'details_url' => $url,
            'edit_url' => $this->canWriteRecord($r, $actor) ? $url.'/edit' : null, 'delete_url' => null];
    }

    /** @param Actor $actor
     * @return array<string,mixed>|null
     */
    protected function duplicatePeriod(Request $request, array $actor): ?array
    {
        $period = $request->session()->get('dd_duplicate_period');
        if (! is_array($period)) {
            return null;
        }
        $project = $this->projectChoices($actor)->where('p.id', $period['project_id'])->first();
        if ($project === null) {
            return null;
        }
        $existing = $this->records($actor)->where('m.project_id', $project->id)
            ->where('m.maintenance_year', $period['maintenance_year'])->where('m.quarter', $period['quarter'])->orderBy('m.id')->first(['m.id']);

        return ['project_id' => (int) $project->id, 'project_title' => $project->project_title,
            'maintenance_year' => (int) $period['maintenance_year'], 'quarter' => $period['quarter'],
            'details_url' => $existing === null ? null : self::BASE.'/maintenance-projects/'.$project->id.'/records/'.$existing->id];
    }

    /** @param Actor $actor */
    protected function updateQuery(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.monthly_updates as u')
            ->join('jairoads_next.maintenance_records as m', 'm.id', '=', 'u.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'u.created_by'), $actor)
            ->select(['u.*', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.managing_engineer_id', 'p.project_title', 'a.username as creator_name'])
            ->selectSub(DB::table('jairoads_next.media as c')->selectRaw('count(*)')->whereColumn('c.monthly_update_id', 'u.id'), 'media_count')
            ->selectSub(DB::table('jairoads_next.media as c')->selectRaw('count(*)')->whereColumn('c.monthly_update_id', 'u.id')->where('c.file_type', 'like', 'image/%'), 'photo_count')
            ->selectSub(DB::table('jairoads_next.media as c')->selectRaw('count(*)')->whereColumn('c.monthly_update_id', 'u.id')->where('c.file_type', 'like', 'video/%'), 'video_count');
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    protected function updateData(\stdClass $u, array $actor): array
    {
        return ['id' => (int) $u->id, 'maintenance_id' => (int) $u->maintenance_id, 'update_month' => $u->update_month,
            'progress_percentage' => (float) $u->progress_percentage, 'summary_of_text_reports' => $u->summary_of_text_reports,
            'created_by' => $u->creator_name, 'created_at' => $u->created_at, 'updated_at' => $u->updated_at,
            'project' => ['id' => (int) $u->project_id, 'project_title' => $u->project_title],
            'record' => ['id' => (int) $u->maintenance_id, 'year' => (int) $u->maintenance_year, 'quarter' => $u->quarter],
            'media_count' => (int) $u->media_count, 'can_edit' => $this->canWriteRecord($u, $actor),
            'photo_count' => (int) $u->photo_count, 'video_count' => (int) $u->video_count, 'other_count' => (int) $u->media_count - (int) $u->photo_count - (int) $u->video_count];
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    protected function parents(array $actor, Request $request, ?int $fixedRecord = null): array
    {
        $context = $fixedRecord ?? ($request->integer('maintenance_id') ?: null);
        $records = $this->records($actor)->when($context !== null, fn (Builder $q) => $q->where('m.id', $context))
            ->orderByDesc('m.maintenance_year')->get(['m.id', 'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.managing_engineer_id'])
            ->filter(fn (\stdClass $r): bool => $this->canWriteRecord($r, $actor));
        abort_if($context !== null && ! $records->contains('id', $context), 403);

        return ['projects' => $this->projectChoices($actor)->whereIn('p.id', $records->pluck('project_id'))->orderBy('p.project_title')->get()
            ->map(fn (\stdClass $p): array => $this->projectChoiceData($p)),
            'records' => $records->map(fn (\stdClass $r): array => $this->periodChoiceData($r))->values(),
            'contextRecordId' => $context, 'canWrite' => true];
    }

    /** @param Actor $actor
     * @return array<int,array<string,mixed>>
     */
    protected function mediaData(int $update, array $actor): array
    {
        return DB::table('jairoads_next.media')->where('monthly_update_id', $update)->orderBy('id')
            ->get(['id', 'file_name', 'file_type'])->map(fn (\stdClass $m): array => [
                'id' => (int) $m->id, 'file_name' => (string) $m->file_name, 'mime_type' => (string) $m->file_type, 'size' => null,
                'available' => $this->media->configured(), 'preview_url' => $this->media->configured() ? '/dd-phase3/files/media/'.$m->id : null,
                'delete_url' => RoleAccess::managesBusinessData($actor['role']) && $this->fileDeletions->available() ? '/dd-phase3/files/media/'.$m->id : null,
                'parent_label' => 'MonthlyUpdate #'.$update,
            ])->all();
    }

    /** @param Actor $actor */
    protected function documentQuery(array $actor): Builder
    {
        return $this->scope(DB::table('jairoads_next.maintenance_documents as d')
            ->join('jairoads_next.maintenance_records as m', 'm.id', '=', 'd.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'm.project_id')
            ->join('jairoads_next.road_coverages as rc', 'rc.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.lgus as l', 'l.id', '=', 'rc.lgu_id')
            ->join('jairoads_next.user_accounts as a', 'a.id', '=', 'd.uploaded_by'), $actor)
            ->select(['d.id', 'd.maintenance_id', 'd.document_title', 'd.description', 'd.file_name', 'd.uploaded_at', 'd.updated_at',
                'm.project_id', 'm.maintenance_year', 'm.quarter', 'm.managing_engineer_id', 'p.project_title', 'l.municipality_name', 'a.username as uploader_name']);
    }

    /** @param Actor $actor
     * @return array<string,mixed>
     */
    protected function documentData(\stdClass $d, array $actor): array
    {
        return ['id' => (int) $d->id, 'maintenance_id' => (int) $d->maintenance_id, 'document_title' => $d->document_title,
            'description' => $d->description, 'file_name' => $d->file_name, 'uploaded_by' => $d->uploader_name,
            'uploaded_at' => $d->uploaded_at, 'updated_at' => $d->updated_at, 'available' => $this->documents->configured(),
            'delete_url' => RoleAccess::managesBusinessData($actor['role']) && $this->fileDeletions->available() ? '/dd-phase3/files/document/'.$d->id : null,
            'download_url' => '/dd-phase3/files/document/'.$d->id, 'can_edit' => $this->canWriteRecord($d, $actor),
            'project' => ['id' => (int) $d->project_id, 'project_title' => $d->project_title, 'municipality' => $d->municipality_name],
            'record' => ['id' => (int) $d->maintenance_id, 'project_id' => (int) $d->project_id, 'year' => (int) $d->maintenance_year, 'quarter' => $d->quarter]];
    }

    /**
     * Existing form-only ID aliases stay at this boundary. A repeated canonical
     * ID may agree (integer or identical decimal string), but never override the
     * visible selection. Canonical operations routes do not use this adapter.
     */
    protected function inputAlias(Request $request, string $frontend, string $canonical): void
    {
        $value = $request->input($frontend);
        if ($request->exists($canonical)) {
            $other = $request->input($canonical);
            if (($value !== null || $other !== null) && ((! is_int($value) && ! is_string($value)) || (! is_int($other) && ! is_string($other)) || (string) $value !== (string) $other)) {
                throw ValidationException::withMessages([$frontend => 'Conflicting values were supplied for this field. Refresh the form and try again.']);
            }
        }
        $request->merge([$canonical => $value]);
    }

    /** @param \Closure():mixed $operation
     * @param  array<string,string>  $aliases
     */
    protected function write(\Closure $operation, array $aliases = []): void
    {
        try {
            $operation();
        } catch (ValidationException $e) {
            $errors = [];
            foreach ($e->errors() as $key => $messages) {
                $errors[$aliases[$key] ?? $key] = $messages;
            }
            throw ValidationException::withMessages($errors);
        }
    }
}
