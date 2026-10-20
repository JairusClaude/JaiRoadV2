<?php

declare(strict_types=1);

namespace App\Http\Controllers\DataDictionary;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdRoleAccess;
use App\Services\DataDictionary\RoadCoverageGeometry;
use App\Services\Documents\PrivateSupabaseStorage;
use App\Services\MonthlyUpdates\PrivateMonthlyMediaStorage;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Final DD module endpoints. public.users is authentication infrastructure only.
 * All business SQL is explicitly jairoads_next qualified and audited.
 */
final class DdOperationsController extends Controller
{
    private const SECTIONS = ['settings','roads','projects','updates','documents'];

    private function actor(Request $request, DataDictionaryIdentityResolver $resolver): array
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('dd_user_account_id') !== null, 403);
        $identity = $resolver->resolve($user);
        abort_unless($identity !== null, 403, 'Your account is unavailable. Please contact your administrator.');
        return $identity;
    }

    private function managers(array $actor): bool
    {
        return DdRoleAccess::managesBusinessData($actor['role']);
    }

    private function writer(array $actor): void
    {
        abort_unless(DdRoleAccess::canWriteOperations($actor['role']), 403, 'This role cannot change operational records.');
    }

    private function t(string $table): \Illuminate\Database\Query\Builder
    {
        return DB::table('jairoads_next.'.$table);
    }

    private function activeLguIds(array $actor): array
    {
        if ($actor['engineer_id'] === null) {
            return [];
        }
        return $this->t('engineer_lgus')->where('engineer_id', $actor['engineer_id'])
            ->where('is_active', true)->pluck('lgu_id')->map(fn ($id) => (int) $id)->all();
    }

    private function lguAllowed(array $actor, int $lguId): void
    {
        if ($this->managers($actor)) {
            return;
        }
        if ($actor['role'] === 'Engineer') {
            abort_unless(in_array($lguId, $this->activeLguIds($actor), true), 403, 'An active assignment to this municipality is required.');
        }
    }

    private function projectLgu(int $id): ?int
    {
        $value = $this->t('maintenance_projects as p')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->where('p.id', $id)->value('r.lgu_id');
        return $value === null ? null : (int) $value;
    }

    private function recordScope(array $actor, int $recordId, bool $write = false): object
    {
        $row = $this->t('maintenance_records as mr')
            ->join('jairoads_next.maintenance_projects as p', 'p.id','=','mr.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id','=','p.road_coverage_id')
            ->where('mr.id', $recordId)->first(['mr.id','mr.project_id','mr.managing_engineer_id','r.lgu_id']);
        abort_unless($row !== null, 404);
        if ($actor['role'] === 'Engineer') {
            $this->lguAllowed($actor, (int) $row->lgu_id);
            if ($write) {
                abort_unless((int) $row->managing_engineer_id === (int) $actor['engineer_id'], 403, 'Current managing Engineer required.');
            }
        } elseif ($write) {
            $this->writer($actor);
        }
        return $row;
    }

    private function audit(array $actor, string $action, string $entity, ?int $id, string $description, array $meta = [], array $oldMeta = []): void
    {
        // Only safe identifiers/statuses; no credentials, email, geometry or private paths.
        $this->t('audit_logs')->insert([
            'user_id' => $actor['account_id'],
            'actor_identifier' => 'DD-UserAccount#'.$actor['account_id'],
            'action' => $action, 'entity_type' => $entity, 'entity_id' => $id,
            'description' => $description,
            'old_value' => $oldMeta === [] ? null : json_encode($oldMeta, JSON_THROW_ON_ERROR),
            'new_value' => $meta === [] ? null : json_encode($meta, JSON_THROW_ON_ERROR),
            'recipient_user_id' => null, 'notification_message' => null,
            'created_at' => now(),
        ]);
        app(\App\Services\DataDictionary\DdActivityNotifications::class)
            ->record($actor, $action, $entity, $id, $description);
    }

    private function done(string $section, string $message): RedirectResponse
    {
        return redirect()->route('jairoads.dd-phase3.show', ['section'=>$section])->with('dd_operations_status', $message);
    }

    public function show(string $section, Request $request, DataDictionaryIdentityResolver $resolver): Response
    {
        abort_unless(in_array($section, self::SECTIONS, true), 404);
        $actor = $this->actor($request, $resolver);
        $activeLgus = $this->activeLguIds($actor);
        $restricted = $actor['role'] === 'Engineer';
        $roads = $this->t('road_coverages')->orderByDesc('id');
        if ($restricted) { $roads->whereIn('lgu_id', $activeLgus); }
        $projects = $this->t('maintenance_projects as p')
            ->join('jairoads_next.road_coverages as r','r.id','=','p.road_coverage_id')
            ->orderByDesc('p.id');
        if ($restricted) { $projects->whereIn('r.lgu_id', $activeLgus); }
        $records = $this->t('maintenance_records as mr')
            ->join('jairoads_next.maintenance_projects as p','p.id','=','mr.project_id')
            ->join('jairoads_next.road_coverages as r','r.id','=','p.road_coverage_id')
            ->orderByDesc('mr.id');
        if ($restricted) { $records->whereIn('r.lgu_id', $activeLgus); }
        $updates = $this->t('monthly_updates as mu')
            ->leftJoin('jairoads_next.user_accounts as author', 'author.id', '=', 'mu.created_by')
            ->join('jairoads_next.maintenance_records as mr','mr.id','=','mu.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p','p.id','=','mr.project_id')
            ->join('jairoads_next.road_coverages as r','r.id','=','p.road_coverage_id')
            ->orderByDesc('mu.id');
        if ($restricted) { $updates->whereIn('r.lgu_id', $activeLgus); }
        $docs = $this->t('maintenance_documents as d')
            ->leftJoin('jairoads_next.user_accounts as uploader', 'uploader.id', '=', 'd.uploaded_by')
            ->join('jairoads_next.maintenance_records as mr','mr.id','=','d.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p','p.id','=','mr.project_id')
            ->join('jairoads_next.road_coverages as r','r.id','=','p.road_coverage_id')
            ->orderByDesc('d.id');
        if ($restricted) { $docs->whereIn('r.lgu_id', $activeLgus); }
        $media = $this->t('media as m')
            ->join('jairoads_next.monthly_updates as mu','mu.id','=','m.monthly_update_id')
            ->join('jairoads_next.maintenance_records as mr','mr.id','=','mu.maintenance_id')
            ->join('jairoads_next.maintenance_projects as p','p.id','=','mr.project_id')
            ->join('jairoads_next.road_coverages as r','r.id','=','p.road_coverage_id')
            ->orderByDesc('m.id');
        if ($restricted) { $media->whereIn('r.lgu_id', $activeLgus); }

        $account = $this->t('user_accounts')->where('id', $actor['account_id'])->first(['username','email','account_type','is_active']);
        return Inertia::render('dd-phase3/Operations', [
            'section'=>$section, 'role'=>$actor['role'], 'canManage'=>$this->managers($actor),
            'engineerId'=>$actor['engineer_id'], 'hasAssignment'=>count($activeLgus) > 0,
            'capabilities'=>DdRoleAccess::capabilities($actor['role'], count($activeLgus) > 0, $actor['engineer_id'] !== null),
            'identity'=>['username'=>(string) $account->username, 'email'=>(string) $account->email, 'role'=>$actor['role']],
            'lgus'=>$this->t('lgus')->when($restricted, fn ($q) => $q->whereIn('id', $activeLgus))->orderBy('id')->limit(300)->get(['id','municipality_name']),
            'engineers'=>$this->t('engineers')->where('engineer_status','Active')->when($restricted, fn ($q) => $q->where('id',$actor['engineer_id']))->orderBy('id')->limit(300)->get(['id','first_name','last_name']),
            // For manager-initiated RoadCoverage creation, the actual Engineer
            // who prepared the mapped coverage must be chosen explicitly.
            // The manager remains the authenticated audit actor.
            'roadCreatorChoices'=>$this->managers($actor)
                ? $this->t('engineer_lgus as el')
                    ->join('jairoads_next.engineers as e','e.id','=','el.engineer_id')
                    ->where('el.is_active',true)
                    ->where('e.engineer_status','Active')
                    ->orderBy('e.last_name')->orderBy('e.first_name')
                    ->limit(500)
                    ->get(['el.engineer_id as id','el.lgu_id','e.first_name','e.last_name'])
                : collect(),
            'roads'=>$roads->limit(300)->get(['id','road_name','lgu_id','kilometers','pavement_type','state_category','created_by','geojson']),
            'projects'=>$projects->limit(300)->get(['p.id','p.project_title','p.road_coverage_id','p.description','p.created_by','r.lgu_id']),
            'records'=>$records->limit(300)->get(['mr.id','mr.project_id','mr.managing_engineer_id','mr.maintenance_year','mr.quarter','mr.start_date','mr.estimated_duration_days','mr.complete_date','mr.status','mr.description','r.lgu_id']),
            'updates'=>$updates->limit(300)->get(['author.username as author_name','mu.id','mu.maintenance_id','mu.update_month','mu.progress_percentage','mu.summary_of_text_reports','mr.managing_engineer_id','r.lgu_id']),
            'documents'=>$docs->limit(300)->get(['uploader.username as uploader_name','d.description','d.id','d.maintenance_id','d.document_title','d.file_name','d.uploaded_at','mr.managing_engineer_id']),
            'media'=>$media->limit(300)->get(['m.id','m.monthly_update_id','m.file_name','m.file_type','mr.managing_engineer_id']),
            'documentsReady'=>app(PrivateSupabaseStorage::class)->configured(),
            'mediaReady'=>app(PrivateMonthlyMediaStorage::class)->configured(),
            'status'=>$request->session()->get('dd_operations_status'),
        ]);
    }

    public function saveRoad(Request $request, DataDictionaryIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'road_name'=>['required','string','max:255'], 'lgu_id'=>['required','integer','min:1'],
            'kilometers'=>['required','numeric','min:0'], 'pavement_type'=>['required',Rule::in(['Concrete','Asphalt','Gravel','Earth'])],
            'state_category'=>['required',Rule::in(['Good','Fair','Bad'])], 'geojson'=>['required','json'],
            // Request-only attribution choice, backed by existing RoadCoverage.CreatedBy.
            // Never changes the 11-entity schema or any business table column.
            'created_by_engineer_id'=>[$id === null && $this->managers($actor) ? 'required' : 'prohibited','integer','min:1'],
        ]);
        $geometry = json_decode($v['geojson'], true);
        // RoadCoverage is mapped road geometry, not a marker/polygon. Preserve
        // line-based GeoJSON wrappers supported by the existing road editor.
        if (! RoadCoverageGeometry::valid($geometry)) {
            throw ValidationException::withMessages([
                'geojson'=>'Provide nonempty road-line GeoJSON with valid longitude/latitude coordinates.',
            ]);
        }
        abort_unless($this->t('lgus')->where('id', $v['lgu_id'])->exists(), 422, 'LGU not found.');
        $this->lguAllowed($actor, (int) $v['lgu_id']);
        $data = [
            'road_name'=>$v['road_name'], 'lgu_id'=>(int)$v['lgu_id'], 'kilometers'=>$v['kilometers'],
            'pavement_type'=>$v['pavement_type'],'state_category'=>$v['state_category'],
            'geojson'=>json_encode($geometry, JSON_THROW_ON_ERROR),'updated_at'=>now(),
        ];
        DB::transaction(function () use ($actor,$data,$id,$v,$request): void {
            if ($id === null) {
                // RoadCoverage.CreatedBy is an Engineer FK. Manager-initiated
                // entries require a named, active, LGU-assigned mapping Engineer.
                // The AuditLog records the real Admin/SuperAdmin actor separately.
                if ($this->managers($actor)) {
                    if (empty($v['created_by_engineer_id'])) {
                        throw ValidationException::withMessages([
                            'created_by_engineer_id'=>'Select the active Engineer who prepared this road coverage.',
                        ]);
                    }
                    $engineerId = (int) $v['created_by_engineer_id'];
                    $eligible = $this->t('engineers as e')
                        ->join('jairoads_next.engineer_lgus as el','el.engineer_id','=','e.id')
                        ->where('e.id',$engineerId)
                        ->where('e.engineer_status','Active')
                        ->where('el.lgu_id',(int) $v['lgu_id'])
                        ->where('el.is_active',true)
                        ->exists();
                    if (! $eligible) {
                        throw ValidationException::withMessages([
                            'created_by_engineer_id'=>'The selected Engineer must be active and assigned to the chosen LGU.',
                        ]);
                    }
                } else {
                    // Engineers can only attribute a creation to themselves.
                    if ($request->exists('created_by_engineer_id')) {
                        throw ValidationException::withMessages([
                            'created_by_engineer_id'=>'Engineer accounts cannot choose another creator.',
                        ]);
                    }
                    $engineerId = $actor['engineer_id'];
                    if ($engineerId === null || ! $this->t('engineers')->where('id', $engineerId)->where('engineer_status','Active')->exists()) {
                        throw ValidationException::withMessages(['road_name'=>'An active, linked Engineer profile is required.']);
                    }
                }
                $id2 = (int) $this->t('road_coverages')->insertGetId($data + ['created_by'=>$engineerId,'created_at'=>now()]);
                $this->audit($actor,'CREATE','RoadCoverage',$id2,'Authorized RoadCoverage created.', [
                    'created_by_engineer_id'=>$engineerId,
                    'lgu_id'=>(int) $v['lgu_id'],
                ]);
            } else {
                $row = $this->t('road_coverages')->where('id',$id)->lockForUpdate()->first(['id','lgu_id']);
                abort_unless($row !== null,404);
                $this->lguAllowed($actor,(int)$row->lgu_id);
                $this->t('road_coverages')->where('id',$id)->update($data);
                // LguID belongs to the road; maintenance history derives LGU
                // from it. Record the old/new scope whenever an authorized
                // update changes that relationship, without exposing geometry.
                if ((int) $row->lgu_id !== (int) $v['lgu_id']) {
                    $this->audit($actor,'UPDATE','RoadCoverage',$id,'Authorized RoadCoverage updated.',
                        ['lgu_id'=>(int) $v['lgu_id']], ['lgu_id'=>(int) $row->lgu_id]);
                } else {
                    $this->audit($actor,'UPDATE','RoadCoverage',$id,'Authorized RoadCoverage updated.');
                }
            }
        });
        return $this->done('roads','Road coverage saved.');
    }

    public function saveProject(Request $request, DataDictionaryIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor = $this->actor($request,$resolver);
        $this->writer($actor);
        $v = $request->validate([
            'project_title'=>['required','string','max:255'],
            'road_coverage_id'=>['required','integer','min:1'],
            'description'=>['nullable','string','max:10000'],
        ]);
        DB::transaction(function () use ($actor,$v,$id): void {
            $road = $this->t('road_coverages')->where('id',$v['road_coverage_id'])->lockForUpdate()->first(['lgu_id']);
            abort_unless($road !== null,404);
            $this->lguAllowed($actor,(int)$road->lgu_id);
            $assigned = $this->t('maintenance_projects')->where('road_coverage_id', $v['road_coverage_id']);
            if ($id !== null) { $assigned->where('id', '!=', $id); }
            if ($assigned->exists()) {
                throw ValidationException::withMessages(['road_coverage_id' => 'This road coverage is already assigned to another project.']);
            }
            if ($id !== null) {
                $existing = $this->t('maintenance_projects')->where('id', $id)->lockForUpdate()->first(['road_coverage_id']);
                abort_unless($existing !== null, 404);
                $old = $this->projectLgu($id);
                abort_unless($old !== null, 404);
                $this->lguAllowed($actor, $old);
                if ((int) $existing->road_coverage_id !== (int) $v['road_coverage_id']
                    && $this->t('maintenance_records')->where('project_id', $id)->exists()) {
                    throw ValidationException::withMessages([
                        'road_coverage_id' => 'Road coverage cannot be changed while this project has maintenance history.',
                    ]);
                }
            }
            $data=['project_title'=>$v['project_title'],'road_coverage_id'=>$v['road_coverage_id'],
                'description'=>$v['description']??null,'updated_at'=>now()];
            if ($id === null) {
                $pid=(int)$this->t('maintenance_projects')->insertGetId($data+['created_by'=>$actor['account_id'],'created_at'=>now()]);
                $this->audit($actor,'CREATE','MaintenanceProject',$pid,'Authorized project created.');
            } else {
                abort_unless($this->t('maintenance_projects')->where('id',$id)->update($data)===1,404);
                $this->audit($actor,'UPDATE','MaintenanceProject',$id,'Authorized project updated.');
            }
        });
        return $this->done('projects','Project saved.');
    }

    public function saveRecord(Request $request, DataDictionaryIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor=$this->actor($request,$resolver);
        $this->writer($actor);
        $v=$request->validate([
            'project_id'=>['required','integer','min:1'],
            'managing_engineer_id'=>['required','integer','min:1'],
            'maintenance_year'=>['required','integer','between:1900,2100'],
            'quarter'=>['required',Rule::in(['Q1','Q2','Q3','Q4'])],
            'start_date'=>['required','date'],'estimated_duration_days'=>['required','integer','min:1'],
            'complete_date'=>['nullable','date','after_or_equal:start_date'],
            'status'=>['required',Rule::in(['Ongoing','Completed'])],
            'description'=>['nullable','string','max:10000'],
        ]);
        if (($v['status']==='Completed') !== !empty($v['complete_date'])) {
            throw ValidationException::withMessages(['complete_date'=>'Completed records require a completion date; ongoing records must not have one.']);
        }
        $lgu=$this->projectLgu((int)$v['project_id']);
        abort_unless($lgu!==null,404);
        $this->lguAllowed($actor,$lgu);
        if ($actor['role']==='Engineer' && (int)$v['managing_engineer_id'] !== (int)$actor['engineer_id']) {
            abort(403,'Engineer cannot assign another managing Engineer.');
        }
        DB::transaction(function () use ($actor,$v,$id): void {
            abort_unless($this->t('engineers')->where('id',$v['managing_engineer_id'])->where('engineer_status','Active')->exists(),422,'Managing Engineer must be active.');
            $data=array_intersect_key($v,array_flip(['project_id','managing_engineer_id','maintenance_year','quarter','start_date','estimated_duration_days','complete_date','status','description']));
            $data['complete_date']=$v['complete_date']??null;
            $data['description']=$v['description']??null;
            $data['updated_at']=now();
            if ($id===null) {
                $rid=(int)$this->t('maintenance_records')->insertGetId($data+['created_by'=>$actor['account_id'],'created_at'=>now()]);
                $this->audit($actor,'CREATE','MaintenanceRecord',$rid,'Authorized maintenance record created.');
            } else {
                $row=$this->recordScope($actor,$id,true);
                if ((int)$row->project_id !== (int)$v['project_id'] || (int)$row->managing_engineer_id !== (int)$v['managing_engineer_id']) {
                    throw ValidationException::withMessages(['project_id'=>'Changing project or managing Engineer requires separately approved reassignment.']);
                }
                $this->t('maintenance_records')->where('id',$id)->update($data);
                $this->audit($actor,'UPDATE','MaintenanceRecord',$id,'Authorized maintenance record updated.');
            }
        });
        return $this->done('projects','Maintenance record saved.');
    }

    public function saveUpdate(Request $request, DataDictionaryIdentityResolver $resolver, ?int $id = null): RedirectResponse
    {
        $actor=$this->actor($request,$resolver);
        $this->writer($actor);
        $v=$request->validate([
            'maintenance_id'=>['required','integer','min:1'],
            'update_month'=>['required','date_format:Y-m'],
            'progress_percentage'=>['required','numeric','between:0,100'],
            'summary_of_text_reports'=>['nullable','string','max:20000'],
        ]);
        $this->recordScope($actor,(int)$v['maintenance_id'],true);
        DB::transaction(function () use ($actor,$v,$id): void {
            // Serialize monthly report changes on the parent record so concurrent
            // submissions receive validation errors rather than duplicate inserts.
            $this->t('maintenance_records')->where('id', $v['maintenance_id'])->lockForUpdate()->first(['id']);
            $duplicate = $this->t('monthly_updates')->where('maintenance_id', $v['maintenance_id'])->where('update_month', $v['update_month']);
            if ($id !== null) { $duplicate->where('id', '!=', $id); }
            if ($duplicate->exists()) {
                throw ValidationException::withMessages(['update_month' => 'An update already exists for this maintenance record and month.']);
            }
            $data=['maintenance_id'=>(int)$v['maintenance_id'],'update_month'=>$v['update_month'],
                'progress_percentage'=>$v['progress_percentage'],
                'summary_of_text_reports'=>$v['summary_of_text_reports']??null,'updated_at'=>now()];
            if ($id===null) {
                if ($this->t('monthly_updates')->where('maintenance_id',$v['maintenance_id'])->where('update_month',$v['update_month'])->exists()) {
                    throw ValidationException::withMessages(['update_month'=>'An update already exists for this maintenance record and month.']);
                }
                $uid=(int)$this->t('monthly_updates')->insertGetId($data+['created_by'=>$actor['account_id'],'created_at'=>now()]);
                $this->audit($actor,'CREATE','MonthlyUpdate',$uid,'Authorized monthly update created.');
            } else {
                $old=$this->t('monthly_updates')->where('id',$id)->first(['maintenance_id']);
                abort_unless($old!==null,404);
                $this->recordScope($actor,(int)$old->maintenance_id,true);
                abort_unless((int)$old->maintenance_id===(int)$v['maintenance_id'],422,'Cannot move monthly update to another maintenance record.');
                $this->t('monthly_updates')->where('id',$id)->update($data);
                $this->audit($actor,'UPDATE','MonthlyUpdate',$id,'Authorized monthly update revised.');
            }
        });
        return $this->done('updates','Monthly update saved.');
    }

    public function saveSettings(Request $request, DataDictionaryIdentityResolver $resolver): RedirectResponse
    {
        $actor=$this->actor($request,$resolver);
        // Final DD grants Engineer/Viewer only Own: R on UserAccount.
        // Self-service account/password mutation remains a client decision.
        abort_unless($this->managers($actor), 403, 'Account changes require administrator authorization.');
        $v=$request->validate([
            'username'=>['required','string','min:3','max:100','regex:/\A[a-zA-Z0-9_.-]+\z/'],
            'current_password'=>['required','string'],
            'password'=>['nullable','confirmed',Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $username=strtolower(trim($v['username']));
        abort_unless(Hash::check($v['current_password'],(string)$request->user()->password),422,'Current password is incorrect.');
        DB::transaction(function () use ($actor,$username,$v,$request): void {
            DB::select('SELECT pg_advisory_xact_lock(1927710963)');
            $account=$this->t('user_accounts')->where('id',$actor['account_id'])->lockForUpdate()->first(['id','username','password']);
            abort_unless($account!==null,403);
            if ($this->t('user_accounts')->whereRaw('LOWER(username) = ?',[$username])->where('id','!=',$actor['account_id'])->exists()) {
                throw ValidationException::withMessages(['username'=>'Username is already in use.']);
            }
            $data=['username'=>$username,'updated_at'=>now()];
            if (!empty($v['password'])) {
                $hash=Hash::make($v['password']);
                $data['password']=$hash;
                DB::table('public.users')->where('id',$request->user()->id)->where('dd_user_account_id',$actor['account_id'])->update(['password'=>$hash,'updated_at'=>now()]);
            }
            $this->t('user_accounts')->where('id',$actor['account_id'])->update($data);
            $this->audit($actor,'UPDATE','UserAccount',$actor['account_id'],'Account holder updated approved identity credentials; no secrets logged.');
        });
        return $this->done('settings','Settings saved. Sign in again if you changed your password.');
    }

    /** Update approved MaintenanceDocument metadata; the private file and parent stay unchanged. */
    public function updateDocument(Request $request, DataDictionaryIdentityResolver $resolver, int $id): RedirectResponse
    {
        $actor = $this->actor($request, $resolver);
        $this->writer($actor);
        $v = $request->validate([
            'document_title' => ['required','string','max:255'],
            'description' => ['nullable','string','max:5000'],
        ]);
        DB::transaction(function () use ($actor, $id, $v): void {
            $document = $this->t('maintenance_documents')->where('id', $id)
                ->lockForUpdate()->first(['id','maintenance_id']);
            abort_unless($document !== null, 404);
            // Engineer must be the ManagingEngineer with an active LGU assignment.
            $this->recordScope($actor, (int) $document->maintenance_id, true);
            $this->t('maintenance_documents')->where('id', $id)->update([
                'document_title' => $v['document_title'],
                'description' => $v['description'] ?? null,
                'updated_at' => now(),
            ]);
            $this->audit($actor, 'UPDATE', 'MaintenanceDocument', $id, 'Approved document metadata revised.');
        });
        return $this->done('documents', 'Document details updated.');
    }

    public function uploadDocument(Request $request, DataDictionaryIdentityResolver $resolver, PrivateSupabaseStorage $storage): RedirectResponse
    {
        $actor=$this->actor($request,$resolver);
        $this->writer($actor);
        $v=$request->validate(['maintenance_id'=>['required','integer','min:1'],
            'document_title'=>['required','string','max:255'], 'description'=>['nullable','string','max:5000'],
            'file'=>['required','file','max:20480','mimes:pdf,docx,xlsx,pptx']]);
        $this->recordScope($actor,(int)$v['maintenance_id'],true);
        if (! $storage->configured()) {
            throw ValidationException::withMessages(['file'=>'Document uploads are temporarily unavailable. Contact your administrator.']);
        }
        $file=$request->file('file');
        $ext=strtolower($file->getClientOriginalExtension());
        $path='maintenance-records/'.(int)$v['maintenance_id'].'/'.(string)Str::uuid().'.'.$ext;
        $storage->upload($file,$path);
        try {
            DB::transaction(function () use ($actor,$v,$file,$path): void {
                $id=(int)$this->t('maintenance_documents')->insertGetId([
                    'maintenance_id'=>(int)$v['maintenance_id'],'document_title'=>$v['document_title'],
                    'description'=>$v['description']??null,'file_name'=>basename($file->getClientOriginalName()),
                    'file_path'=>$path,'uploaded_by'=>$actor['account_id'], 'uploaded_at'=>now(),'updated_at'=>now(),
                ]);
                $this->audit($actor,'CREATE','MaintenanceDocument',$id,'Formal maintenance document uploaded.');
            });
        } catch (\Throwable $e) {
            try { $storage->removeAfterFailure($path); } catch (\Throwable $cleanup) { report($cleanup); }
            throw $e;
        }
        return $this->done('documents','Document uploaded.');
    }

    public function uploadMedia(Request $request, DataDictionaryIdentityResolver $resolver, PrivateMonthlyMediaStorage $storage): RedirectResponse
    {
        $actor=$this->actor($request,$resolver);
        $this->writer($actor);
        $v=$request->validate(['monthly_update_id'=>['required','integer','min:1'],
            'file'=>['required','file','max:20480','mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm']]);
        $update=$this->t('monthly_updates')->where('id',$v['monthly_update_id'])->first(['maintenance_id']);
        abort_unless($update!==null,404);
        $this->recordScope($actor,(int)$update->maintenance_id,true);
        if (! $storage->configured()) {
            throw ValidationException::withMessages(['file'=>'Evidence uploads are temporarily unavailable. Contact your administrator.']);
        }
        $file=$request->file('file');
        $mime=(string)$file->getMimeType();
        $ext=match ($mime) {
            'image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm',
            default=>throw ValidationException::withMessages(['file'=>'Unsupported media MIME type.']),
        };
        $path='monthly-updates/'.(int)$v['monthly_update_id'].'/'.(string)Str::uuid().'.'.$ext;
        $storage->upload($file,$path);
        try {
            DB::transaction(function () use ($actor,$v,$file,$path,$mime): void {
                $id=(int)$this->t('media')->insertGetId([
                    'monthly_update_id'=>(int)$v['monthly_update_id'],'file_name'=>basename($file->getClientOriginalName()),
                    'file_path'=>$path,'file_type'=>$mime,'uploaded_by'=>$actor['account_id'],'created_at'=>now(),
                ]);
                $this->audit($actor,'CREATE','Media',$id,'MonthlyUpdate media evidence uploaded.');
            });
        } catch (\Throwable $e) {
            try { $storage->removeAfterFailure($path); } catch (\Throwable $cleanup) { report($cleanup); }
            throw $e;
        }
        return $this->done('updates','Evidence uploaded.');
    }

    public function deleteEntity(Request $request, DataDictionaryIdentityResolver $resolver, string $entity, int $id): RedirectResponse
    {
        $actor=$this->actor($request,$resolver);
        abort_unless($this->managers($actor),403,'Only Admin/SuperAdmin may delete approved entities.');
        $allowed=['roads'=>['road_coverages','RoadCoverage'],
            'projects'=>['maintenance_projects','MaintenanceProject'],
            'records'=>['maintenance_records','MaintenanceRecord'],
            'updates'=>['monthly_updates','MonthlyUpdate']];
        abort_unless(isset($allowed[$entity]),404);
        [$table,$type]=$allowed[$entity];
        DB::transaction(function () use ($actor,$id,$table,$type): void {
            $row=$this->t($table)->where('id',$id)->lockForUpdate()->first(['id']);
            abort_unless($row!==null,404);
            try {
                $this->t($table)->where('id',$id)->delete();
            } catch (QueryException) {
                throw ValidationException::withMessages(['delete'=>'This item is still referenced by other records and cannot be deleted.']);
            }
            $this->audit($actor,'DELETE',$type,$id,'Authorized entity removed after restrictive FK check.');
        });
        $section=match($entity) { 'roads'=>'roads','projects','records'=>'projects','updates'=>'updates' };
        return $this->done($section,'Item deleted.');
    }

    public function download(Request $request, DataDictionaryIdentityResolver $resolver, string $kind, int $id, PrivateSupabaseStorage $documents, PrivateMonthlyMediaStorage $media): HttpResponse
    {
        abort_unless(in_array($kind,['document','media'],true),404);
        $actor=$this->actor($request,$resolver);
        if ($kind==='document') {
            $row=$this->t('maintenance_documents')->where('id',$id)->first(['maintenance_id','file_name','file_path']);
            abort_unless($row!==null,404);
            $this->recordScope($actor,(int)$row->maintenance_id);
            $result=$documents->fetch((string)$row->file_path);
            $mime=match (strtolower(pathinfo($row->file_name,PATHINFO_EXTENSION))) {
                'pdf'=>'application/pdf','docx'=>'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xlsx'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'pptx'=>'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                default=>'application/octet-stream',
            };
        } else {
            $row=$this->t('media as m')->join('jairoads_next.monthly_updates as mu','mu.id','=','m.monthly_update_id')
                ->where('m.id',$id)->first(['mu.maintenance_id','m.file_name','m.file_path','m.file_type']);
            abort_unless($row!==null,404);
            $this->recordScope($actor,(int)$row->maintenance_id);
            $result=$media->fetch((string)$row->file_path);
            $mime=(string)$row->file_type;
        }
        $filename=basename(str_replace(['\\','/'], '', (string)$row->file_name));
        return response($result->body(),200,[
            'Content-Type'=>$mime, 'X-Content-Type-Options'=>'nosniff',
            'Cache-Control'=>'private, no-store',
            'Content-Disposition'=>"attachment; filename*=UTF-8''".rawurlencode($filename),
        ]);
    }
}
