<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Professional assignment identity is separate from creator and administrative permission. */
final class ManagingEngineerEligibility
{
    /** @param array{account_id:int, role:string, engineer_id:?int} $actor */
    public function choices(array $actor, int $lguId): Builder
    {
        return DB::table('jairoads_next.engineers as e')
            ->join('jairoads_next.user_accounts as ua', 'ua.engineer_id', '=', 'e.id')
            ->join('jairoads_next.engineer_lgus as el', 'el.engineer_id', '=', 'e.id')
            ->where('e.engineer_status', 'Active')
            ->where('ua.is_active', true)
            ->where('el.is_active', true)
            ->where('el.lgu_id', $lguId)
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
                403, 'An active linked Engineer account and assignment to this municipality are required.');
        }
    }

    /**
     * Called only inside the record mutation transaction. Shared locks prevent
     * profile/account deactivation or LGU unassignment during the insert.
     *
     * @param  array{account_id:int, role:string, engineer_id:?int}  $actor
     */
    public function validate(array $actor, int $engineerId, int $lguId): void
    {
        if ($this->choices($actor, $lguId)->where('e.id', $engineerId)->sharedLock()->first() === null) {
            throw ValidationException::withMessages([
                'managing_engineer_id' => 'Choose an active Engineer account and profile with an active assignment to this municipality. A linked Admin may select themselves.',
            ]);
        }
    }
}
