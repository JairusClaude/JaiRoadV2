<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Preview and commit one RoadCoverage LGU transition; never rewrite inherited history.
 * No persistent preview table, geographic assumptions, or notification fan-out.
 *
 * @phpstan-type Identity array{account_id:int,role:string,engineer_id:?int}
 * @phpstan-type Inspection array{actor:Identity,impact:array<string,mixed>,fingerprint:string}
 */
final class RoadMunicipalityChange
{
    public function __construct(private DataDictionaryIdentityResolver $identities) {}

    /** @return array<string,mixed> */
    public function preview(User $login, int $roadId, int $destination): array
    {
        $this->actor($login);

        return DB::transaction(function () use ($login, $roadId, $destination): array {
            $state = $this->inspect($login, $roadId, $destination);

            return $state['impact'] + ['confirmation_token' => Crypt::encryptString(json_encode([
                'login_id' => (int) $login->getKey(), 'account_id' => $state['actor']['account_id'],
                'road_id' => $roadId, 'destination' => $destination, 'fingerprint' => $state['fingerprint'],
                'expires_at' => now()->addMinutes(15)->timestamp,
            ], JSON_THROW_ON_ERROR))];
        }, 3);
    }

    /**
     * The caller supplies the existing audit writer, never client actor/recipient IDs.
     * An audit exception escapes and rolls back the LGU change in this transaction.
     *
     * @param  Closure(Identity,array<string,mixed>):void  $audit
     * @return array<string,mixed>
     */
    public function confirm(User $login, int $roadId, string $token, Closure $audit): array
    {
        $actor = $this->actor($login);
        try {
            $claim = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException) {
            $this->stale();
        }
        if (! is_array($claim) || ($claim['login_id'] ?? null) !== (int) $login->getKey()
            || ($claim['account_id'] ?? null) !== $actor['account_id'] || ($claim['road_id'] ?? null) !== $roadId
            || ! is_int($claim['destination'] ?? null) || ! is_int($claim['expires_at'] ?? null)
            || $claim['expires_at'] <= now()->timestamp || ! is_string($claim['fingerprint'] ?? null)) {
            $this->stale();
        }

        return DB::transaction(function () use ($login, $roadId, $claim, $audit): array {
            $current = $this->inspect($login, $roadId, $claim['destination']);
            if ($claim['expires_at'] <= now()->timestamp || ! hash_equals($claim['fingerprint'], $current['fingerprint'])) {
                $this->stale();
            }
            $impact = $current['impact'];
            if ($impact['conflicts'] !== []) {
                throw ValidationException::withMessages(['confirmation_token' => $impact['conflicts']]);
            }
            // Deliberately update only these two columns. Never round-trip geometry,
            // length, creators, project records, attachments, or historical AuditLog rows.
            $this->table('road_coverages')->where('id', $roadId)->update([
                'lgu_id' => $claim['destination'], 'updated_at' => now()->format('Y-m-d H:i:s.u'),
            ]);
            $audit($current['actor'], $impact);

            return $impact;
        }, 3);
    }

    private function stale(): never
    {
        throw ValidationException::withMessages([
            'confirmation_token' => 'This review is outdated or invalid. Review current municipality, assignments and maintenance history again before confirming.',
        ]);
    }

    /** @return Identity */
    private function actor(User $login): array
    {
        $actor = $this->identities->resolve($login);
        abort_unless($actor !== null && DdRoleAccess::canWriteOperations($actor['role']), 403);
        abort_if($actor['role'] === 'Engineer' && $actor['engineer_id'] === null, 403, 'An active linked Engineer profile is required.');

        return $actor;
    }

    private function table(string $table): Builder
    {
        return DB::table('jairoads_next.'.$table);
    }

    /** @return Inspection */
    private function inspect(User $login, int $roadId, int $destination): array
    {
        $actor = $this->actor($login);
        // Parent -> child lock order matches project/record writers. FOR UPDATE
        // also blocks concurrent FK insertions into each locked parent, so the
        // impact cannot gain unseen projects/records/attachments before commit.
        $road = $this->table('road_coverages')->where('id', $roadId)->lockForUpdate()->first();
        abort_unless($road !== null, 404);
        $lgus = $this->table('lgus')->whereIn('id', [(int) $road->lgu_id, $destination])->orderBy('id')->sharedLock()->get(['id', 'municipality_name']);
        $old = $lgus->firstWhere('id', $road->lgu_id);
        $new = $lgus->firstWhere('id', $destination);
        abort_unless($old !== null && $new !== null, 422, 'Municipality not found.');
        if ((int) $road->lgu_id === $destination) {
            throw ValidationException::withMessages(['lgu_id' => 'Choose a different municipality. If the road changed, refresh its details and review again.']);
        }
        $projects = $this->table('maintenance_projects')->where('road_coverage_id', $roadId)->orderBy('id')->lockForUpdate()->get();
        $records = $this->table('maintenance_records')->whereIn('project_id', $projects->pluck('id'))->orderBy('id')->lockForUpdate()->get();
        $updates = $this->table('monthly_updates')->whereIn('maintenance_id', $records->pluck('id'))->orderBy('id')->lockForUpdate()->get(['id', 'maintenance_id', 'updated_at']);
        $documents = $this->table('maintenance_documents')->whereIn('maintenance_id', $records->pluck('id'))->orderBy('id')->sharedLock()->get(['id', 'maintenance_id', 'updated_at']);
        $media = $this->table('media')->whereIn('monthly_update_id', $updates->pluck('id'))->orderBy('id')->sharedLock()->get(['id', 'monthly_update_id']);
        $engineerIds = $records->pluck('managing_engineer_id')->push($actor['engineer_id'])->filter()->unique()->values();
        $engineers = $this->table('engineers')->whereIn('id', $engineerIds)->orderBy('id')->sharedLock()->get(['id', 'first_name', 'last_name', 'engineer_status']);
        $accounts = $this->table('user_accounts')->where(fn (Builder $q) => $q->whereIn('engineer_id', $engineerIds)->orWhere('id', $actor['account_id']))
            ->orderBy('id')->sharedLock()->get(['id', 'engineer_id', 'account_type', 'is_active', 'updated_at']);
        $assignments = $this->table('engineer_lgus')->whereIn('engineer_id', $engineerIds)->whereIn('lgu_id', [(int) $road->lgu_id, $destination])
            ->orderBy('engineer_id')->orderBy('lgu_id')->sharedLock()->get(['engineer_id', 'lgu_id', 'is_active']);
        // Freeze the explicit Fortify bridge, then re-resolve after account/profile
        // locks. Never infer canonical identity from matching email or numeric IDs.
        $bridge = DB::table('public.users')->where('id', $login->getKey())->sharedLock()->first(['id', 'dd_user_account_id', 'updated_at']);
        abort_unless($this->actor($login) === $actor, 403);
        if ($actor['role'] === 'Engineer') {
            foreach ([(int) $road->lgu_id, $destination] as $lguId) {
                abort_unless($actor['engineer_id'] !== null && $assignments->contains(fn (\stdClass $a): bool => (int) $a->engineer_id === $actor['engineer_id']
                    && (int) $a->lgu_id === $lguId && $a->is_active === true), 403,
                    'An active Engineer profile and active assignments to both the current and destination municipalities are required.');
            }
        }
        $managers = [];
        $conflicts = [];
        foreach ($records as $record) {
            $engineer = $engineers->firstWhere('id', $record->managing_engineer_id);
            $account = $accounts->firstWhere('engineer_id', $record->managing_engineer_id);
            // An existing linked Admin manager retains their approved self-management
            // eligibility; this operation never assigns a new manager of any role.
            $eligible = $engineer !== null && $engineer->engineer_status === 'Active'
                && $account !== null && $account->is_active === true && in_array($account->account_type, ['Engineer', 'Admin'], true)
                && $assignments->contains(fn (\stdClass $a): bool => (int) $a->engineer_id === (int) $record->managing_engineer_id
                    && (int) $a->lgu_id === $destination && $a->is_active === true);
            $managerName = $engineer === null ? 'Missing Engineer' : trim($engineer->first_name.' '.$engineer->last_name);
            $managers[] = ['maintenance_record_id' => (int) $record->id, 'engineer_id' => (int) $record->managing_engineer_id,
                'name' => $managerName, 'eligible' => $eligible];
            if (! $eligible) {
                $conflicts[] = 'MaintenanceRecord #'.$record->id.' ('.$managerName.') needs an eligible manager for '.$new->municipality_name.'. Ask an Admin/SuperAdmin to resolve assignments or use the explicit reassignment workflow, then refresh this review.';
            }
        }
        $impact = [
            'road' => ['id' => $roadId, 'name' => $road->road_name],
            'previous' => ['lgu_id' => (int) $old->id, 'municipality' => $old->municipality_name],
            'proposed' => ['lgu_id' => (int) $new->id, 'municipality' => $new->municipality_name],
            'projects' => $projects->map(fn (\stdClass $p): array => ['id' => (int) $p->id, 'title' => $p->project_title])->all(),
            'maintenance_record_ids' => $records->pluck('id')->map(fn ($id): int => (int) $id)->all(),
            'counts' => ['maintenance_records' => $records->count(), 'monthly_updates' => $updates->count(), 'documents' => $documents->count(), 'media' => $media->count()],
            'managers' => $managers, 'conflicts' => $conflicts, 'can_confirm' => $conflicts === [],
        ];

        return ['actor' => $actor, 'impact' => $impact, 'fingerprint' => hash('sha256', json_encode([
            $road, $lgus, $projects, $records, $updates, $documents, $media, $engineers, $accounts, $assignments, $bridge, $actor,
        ], JSON_THROW_ON_ERROR))];
    }
}
