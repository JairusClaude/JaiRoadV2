<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Immutable evidence is separate from business AuditLog and never inferred from it. */
final class AccountProvisioning
{
    public const TABLE = 'jairoads_security.account_provisioning';

    public function available(): bool
    {
        return DB::connection()->getDriverName() === 'pgsql'
            && DB::selectOne("SELECT CASE WHEN to_regclass('jairoads_security.account_provisioning') IS NULL THEN false
                ELSE has_schema_privilege(current_user, 'jairoads_security', 'USAGE')
                AND has_table_privilege(current_user, 'jairoads_security.account_provisioning', 'SELECT') END AS allowed")->allowed;
    }

    public function verified(int $accountId, string $role, ?int $engineerId): bool
    {
        return $this->available() && DB::table(self::TABLE)->where('user_account_id', $accountId)
            ->where('provisioned_role', $role)->where('engineer_id', $engineerId)->exists();
    }

    public function record(User $login, int $accountId): void
    {
        abort_unless(DB::transactionLevel() > 0 && $this->available(), 503);
        $actor = app(DataDictionaryIdentityResolver::class)->resolve($login);
        abort_unless($actor !== null && DdRoleAccess::canManageAccounts($actor['role']), 403);
        $account = DB::table('jairoads_next.user_accounts')->where('id', $accountId)->firstOrFail();
        abort_unless(in_array($account->account_type, ['Admin', 'Engineer', 'Viewer'], true), 403);
        DB::table(self::TABLE)->insert([
            'user_account_id' => $accountId, 'provisioned_by' => $actor['account_id'],
            'provisioner_role' => $actor['role'], 'provisioned_role' => $account->account_type,
            'engineer_id' => $account->engineer_id, 'method' => 'administrator',
        ]);
    }
}
