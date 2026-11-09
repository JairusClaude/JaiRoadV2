<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\AccountProvisioning;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** Read only; outputs IDs/reason codes, never passwords, hashes, email or tokens. */
final class CanonicalAccessPreflight extends Command
{
    protected $signature = 'jairoads:canonical-access-preflight {--summary : Print aggregate readiness counts without identifiers}';

    protected $description = 'Read-only canonical access readiness and remediation inventory';

    public function handle(AccountIdentityResolver $resolver, AccountProvisioning $provisioning): int
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            $this->error('PostgreSQL required.');

            return self::FAILURE;
        }
        // PostgreSQL enforces the read-only promise, including accidental writes.
        $report = DB::transaction(function () use ($resolver, $provisioning): array {
            DB::statement('SET TRANSACTION READ ONLY');
            $rows = [];
            foreach (DB::table('jairoads_next.user_accounts as a')->leftJoin('jairoads_next.engineers as e', 'a.engineer_id', '=', 'e.id')
                ->orderBy('a.id')->get(['a.id', 'a.account_type', 'a.engineer_id', 'a.is_active', 'e.engineer_status']) as $a) {
                $issues = [];
                $logins = User::where('dd_user_account_id', $a->id)->get();
                if (! $a->is_active) {
                    $issues[] = 'inactive';
                }
                if (! AccountIdentityResolver::roleLinkValid($a->account_type, $a->engineer_id)) {
                    $issues[] = 'role_profile_conflict';
                }
                if ($a->account_type === 'Engineer' && $a->engineer_id === null) {
                    $issues[] = 'needs_engineer_link';
                }
                if ($a->account_type === 'Admin' && $a->engineer_id === null
                    && ! $provisioning->verified((int) $a->id, $a->account_type, null)) {
                    // No silent grandfathering of existing Admins without review evidence.
                    $issues[] = 'needs_existing_admin_review';
                }
                if ($a->engineer_id !== null && $a->engineer_status !== 'Active') {
                    $issues[] = 'missing_or_retired_profile';
                }
                if ($a->account_type !== 'SuperAdmin' && ! $provisioning->verified((int) $a->id, $a->account_type, $a->engineer_id)) {
                    $issues[] = 'needs_reviewed_provisioning_evidence';
                }
                if ($logins->count() !== 1) {
                    $issues[] = 'missing_or_ambiguous_fortify_bridge';
                } elseif (! DB::table('public.users as u')->join('jairoads_next.user_accounts as a', 'u.dd_user_account_id', '=', 'a.id')
                    ->where('a.id', $a->id)->whereRaw('lower(u.email) = lower(a.email) AND u.password = a.password')->exists()) {
                    $issues[] = 'email_or_credential_mismatch';
                }
                $eligible = $logins->count() === 1 && $resolver->resolve($logins->first()) !== null;
                if (! $eligible && $issues === []) {
                    $issues[] = 'invalid_fortify_link_or_credential_integrity';
                }
                $rows[] = ['account_id' => $a->id, 'account_type' => $a->account_type, 'engineer_id' => $a->engineer_id,
                    'eligible' => $eligible, 'fortify_links' => $logins->count(), 'issues' => $issues];
            }

            return ['provenance_available' => $provisioning->available(), 'accounts' => $rows,
                'legacy_only_login_ids' => User::whereNull('dd_user_account_id')->orderBy('id')->pluck('id')->all(),
                'orphaned_bridge_login_ids' => User::whereNotNull('dd_user_account_id')->whereNotIn('dd_user_account_id', DB::table('jairoads_next.user_accounts')->select('id'))->orderBy('id')->pluck('id')->all()];
        });
        if ($this->option('summary')) {
            // Safe to share with reviewers: role-level counts only. No IDs,
            // logins, email addresses, profile names, tokens or hashes.
            $summary = [
                'provenance_available' => $report['provenance_available'],
                'roles' => array_fill_keys(['SuperAdmin', 'Admin', 'Engineer', 'Viewer'], [
                    'total' => 0, 'eligible' => 0, 'needs_engineer_link' => 0,
                    'needs_existing_admin_review' => 0, 'needs_reviewed_provisioning_evidence' => 0,
                ]),
                'legacy_only_login_count' => count($report['legacy_only_login_ids']),
                'orphaned_bridge_login_count' => count($report['orphaned_bridge_login_ids']),
            ];
            foreach ($report['accounts'] as $account) {
                $role = $account['account_type'];
                if (! isset($summary['roles'][$role])) {
                    continue;
                }
                $summary['roles'][$role]['total']++;
                if ($account['eligible']) {
                    $summary['roles'][$role]['eligible']++;
                }
                foreach (['needs_engineer_link', 'needs_existing_admin_review', 'needs_reviewed_provisioning_evidence'] as $issue) {
                    if (in_array($issue, $account['issues'], true)) {
                        $summary['roles'][$role][$issue]++;
                    }
                }
            }
            $this->line(json_encode($summary, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        }

        $this->line(json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
