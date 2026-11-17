<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\LinkedPasswordUpdater;
use App\Services\OperationAudit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/** Separate trusted-operator recovery: never exposed as a web endpoint. */
final class RecoverCanonicalSuperAdmin extends Command
{
    protected $signature = 'jairoads:recover-superadmin';

    protected $description = 'Trusted operator only: recover another eligible SuperAdmin using a working SuperAdmin password';

    public function handle(AccountIdentityResolver $identities, LinkedPasswordUpdater $passwords): int
    {
        if (! $this->input->isInteractive() || $this->ask('Type TRUSTED DATABASE OPERATOR to proceed') !== 'TRUSTED DATABASE OPERATOR') {
            $this->error('Interactive trusted-operator acknowledgement is required.');

            return self::FAILURE;
        }

        $approverId = (string) $this->ask('Working SuperAdmin canonical account ID');
        $targetId = (string) $this->ask('Reviewed target SuperAdmin canonical account ID');
        $reference = trim((string) $this->ask('Private approved recovery reference'));
        if (! ctype_digit($approverId) || ! ctype_digit($targetId)
            || (int) $approverId < 1 || (int) $targetId < 1 || (int) $approverId === (int) $targetId
            || strlen($reference) < 8 || strlen($reference) > 500) {
            $this->error('Distinct valid account IDs and an actual private review reference are required.');

            return self::FAILURE;
        }
        if (! $this->confirm('I have independently verified the target SuperAdmin identity and authorization, and have a tested recovery plan.')) {
            return self::FAILURE;
        }
        $current = (string) $this->secret('Working SuperAdmin password', false);
        $new = (string) $this->secret('New target password', false);
        $confirmation = (string) $this->secret('Confirm new target password', false);
        if (strlen($current) > 1024 || strlen($new) > 72 || ! hash_equals($new, $confirmation)
            || Validator::make(['password' => $new], ['password' => ['required', Password::min(12)->mixedCase()->numbers()->symbols()]])->fails()) {
            $this->error('Password validation failed. Use 12 or more characters, mixed case, numbers and symbols, at most 72 bytes.');

            return self::FAILURE;
        }
        try {
            DB::transaction(function () use ($identities, $passwords, $approverId, $targetId, $current, $new): void {
                DB::select('SELECT pg_advisory_xact_lock_shared(1927710916)');
                DB::select('SELECT pg_advisory_xact_lock(1927710914)');
                $logins = User::query()->whereIn('dd_user_account_id', [(int) $approverId, (int) $targetId])
                    ->orderBy('id')->lockForUpdate()->get();
                DB::table('jairoads_next.user_accounts')->whereIn('id', [(int) $approverId, (int) $targetId])
                    ->orderBy('id')->lockForUpdate()->get(['id']);
                $approver = $logins->first(fn (User $u): bool => (int) $u->dd_user_account_id === (int) $approverId);
                $target = $logins->first(fn (User $u): bool => (int) $u->dd_user_account_id === (int) $targetId);
                $actor = $approver ? $identities->resolve($approver) : null;
                $identity = $target ? $identities->resolveForRecovery($target) : null;
                abort_unless($logins->count() === 2 && $actor !== null && $actor['role'] === 'SuperAdmin'
                    && $identity !== null && $identity['role'] === 'SuperAdmin'
                    && Hash::check($current, $approver->getAuthPassword()), 403);
                $passwords->reset($target, $new);
                $broker = (string) config('auth.defaults.passwords', 'users');
                DB::table(config('auth.passwords.'.$broker.'.table', 'password_reset_tokens'))
                    ->where('email', $target->getEmailForPasswordReset())->delete();
                app(OperationAudit::class)->recordAdministratorPasswordReset($actor, (int) $targetId, true);
            }, 3);
        } catch (\Throwable) {
            // Do not print SQL bindings or credential details.
            $this->error('Recovery was not confirmed. Check operator access, account eligibility and database configuration before retrying.');

            return self::FAILURE;
        }

        $this->info('Target SuperAdmin password reset. The approving account was not changed. Record the outcome in the private review.');

        return self::SUCCESS;
    }
}
