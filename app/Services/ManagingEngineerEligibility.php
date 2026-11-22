<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Professional assignment identity is separate from creator and administrative permission. */
final class ManagingEngineerEligibility
{
    /** @param array{account_id:int, role:string, engineer_id:?int} $actor */
    public function choices(array $actor, int $lguId): Builder
    {
        return $this->eligibleChoices($actor);
    }

    /**
     * Legacy batched-choice API: the approved Engineer eligibility is global,
     * independent of LGU. Enumerate eligible Engineers for each requested LGU
     * in one SQL statement without issuing one query per municipality.
     *
     * @param array{account_id:int,role:string,engineer_id:?int} $actor
     * @param list<int> $lguIds
     */
    public function choicesForLgus(array $actor, array $lguIds): Builder
    {
        $ids = array_values(array_unique(array_map('intval', $lguIds)));

        return $this->eligibleChoices($actor)
            ->crossJoin('jairoads_next.lgus as l')
            ->whereIn('l.id', $ids)->addSelect('l.id as lgu_id');
    }

    /** @param array{account_id:int, role:string, engineer_id:?int} $actor
     */
    public function eligibleChoices(array $actor): Builder
    {
        return DB::table('jairoads_next.engineers as e')
            ->join('jairoads_next.user_accounts as ua', 'ua.engineer_id', '=', 'e.id')
            ->where('e.engineer_status', 'Active')
            ->where('ua.is_active', true)
            ->where(function (Builder $query) use ($actor): void {
                $query->where('ua.account_type', 'Engineer');
                // The approved Admin exception is self-management, not assigning other Admins.
                if ($actor['role'] === 'Admin') {
                    $query->orWhere(fn (Builder $self) => $self->where('ua.account_type', 'Admin')->where('ua.id', $actor['account_id']));
                }
            })
            ->when($actor['role'] === 'Engineer', fn (Builder $query) => $query->where('ua.id', $actor['account_id']))
            ->select(['e.id', 'e.first_name', 'e.last_name'])
            ->orderBy('e.last_name')->orderBy('e.first_name')->orderBy('e.id');
    }

    /** @param array{account_id:int, role:string, engineer_id:?int} $actor */
    public function assertProjectActor(array $actor, int $lguId): void
    {
        if ($actor['role'] === 'Engineer') {
            abort_unless($actor['engineer_id'] !== null && $this->choices($actor, $lguId)
                ->where('e.id', $actor['engineer_id'])->sharedLock()->first() !== null,
                403, 'An active linked Engineer account is required.');
        }
    }

    /**
     * Called only inside the record mutation transaction. Shared locks prevent
     * profile/account deactivation during the insert.
     *
     * @param  array{account_id:int, role:string, engineer_id:?int}  $actor
     */
    public function validate(array $actor, int $engineerId, int $lguId): void
    {
        if ($this->choices($actor, $lguId)->where('e.id', $engineerId)->sharedLock()->first() === null) {
            throw ValidationException::withMessages([
                'managing_engineer_id' => 'Choose an active Engineer account and profile. A linked Admin may select themselves.',
            ]);
        }
    }
}
