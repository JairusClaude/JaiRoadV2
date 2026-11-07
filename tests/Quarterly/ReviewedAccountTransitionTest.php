<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\DataDictionary\AccountProvisioning;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

final class ReviewedAccountTransitionTest extends PostgresTestCase
{
    public function test_synthetic_unlinked_admin_stays_denied_until_real_profile_link_and_reviewed_evidence_exist(): void
    {
        // This only represents synthetic identity verification: it is NOT a
        // proposed automatic match between real people and Engineer records.
        $admin = $this->account('Admin', linked: false);
        $root = User::where('dd_user_account_id', DB::table('jairoads_next.user_accounts')
            ->where('account_type', 'SuperAdmin')->value('id'))->firstOrFail();
        $resolver = app(DataDictionaryIdentityResolver::class);
        $before = DB::table('jairoads_next.user_accounts')->where('id', $admin->dd_user_account_id)->first();
        $this->assertNull($resolver->resolve($admin));

        $profile = $this->engineer();
        $evidence = [
            'user_account_id' => $admin->dd_user_account_id,
            'provisioned_by' => $root->dd_user_account_id,
            'provisioner_role' => 'SuperAdmin',
            'provisioned_role' => 'Admin',
            'engineer_id' => $profile,
            'method' => 'reviewed_transition',
            'review_reference' => 'SYNTHETIC-OWNER-REVIEW-2026-11-07',
        ];
        try {
            DB::transaction(fn () => DB::table(AccountProvisioning::TABLE)->insert($evidence));
            $this->fail('An unlinked canonical account must not receive evidence.');
        } catch (QueryException $error) {
            $this->assertSame('23514', $error->errorInfo[0]);
        }
        $this->assertDatabaseMissing(AccountProvisioning::TABLE, ['user_account_id' => $admin->dd_user_account_id]);

        // The profile association is accepted ONLY because this is synthetic.
        DB::table('jairoads_next.user_accounts')->where('id', $admin->dd_user_account_id)
            ->update(['engineer_id' => $profile]);
        $this->assertNull($resolver->resolve($admin));
        DB::table(AccountProvisioning::TABLE)->insert($evidence);

        $eligible = $resolver->resolve($admin);
        $this->assertNotNull($eligible);
        $this->assertSame('Admin', $eligible['role']);
        $this->assertSame($profile, $eligible['engineer_id']);
        $this->postJson('/login', [
            'email' => $admin->email, 'password' => 'Disposable-Test!123',
        ])->assertOk();
        $this->assertAuthenticatedAs($admin);
        $this->assertSame($before->email, $admin->fresh()->email);
        $this->assertSame($before->password, $admin->fresh()->password);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->assertDatabaseHas(AccountProvisioning::TABLE, [
            'user_account_id' => $admin->dd_user_account_id,
            'method' => 'reviewed_transition',
            'review_reference' => 'SYNTHETIC-OWNER-REVIEW-2026-11-07',
        ]);
    }

    public function test_review_record_cannot_be_short_or_forged_by_a_viewer_or_duplicated(): void
    {
        $viewer = $this->account('Viewer');
        $root = User::where('dd_user_account_id', DB::table('jairoads_next.user_accounts')
            ->where('account_type', 'SuperAdmin')->value('id'))->firstOrFail();
        $target = $this->account('Engineer', linked: false);
        $profile = $this->engineer();
        DB::table('jairoads_next.user_accounts')->where('id', $target->dd_user_account_id)
            ->update(['engineer_id' => $profile]);
        $trusted = [
            'user_account_id' => $target->dd_user_account_id,
            'provisioned_by' => $root->dd_user_account_id,
            'provisioner_role' => 'SuperAdmin',
            'provisioned_role' => 'Engineer',
            'engineer_id' => $profile,
            'method' => 'reviewed_transition',
            'review_reference' => 'SYNTHETIC-REVIEW-EVIDENCE-0001',
        ];
        foreach ([
            array_replace($trusted, ['review_reference' => 'short']),
            array_replace($trusted, ['provisioned_by' => $viewer->dd_user_account_id, 'provisioner_role' => 'Admin']),
            array_replace($trusted, ['engineer_id' => $this->engineer()]),
        ] as $invalid) {
            try {
                DB::transaction(fn () => DB::table(AccountProvisioning::TABLE)->insert($invalid));
                $this->fail('Invalid transition must not be accepted.');
            } catch (QueryException $error) {
                $this->assertSame('23514', $error->errorInfo[0]);
            }
        }
        $this->assertDatabaseMissing(AccountProvisioning::TABLE, ['user_account_id' => $target->dd_user_account_id]);
        DB::table(AccountProvisioning::TABLE)->insert($trusted);
        try {
            DB::transaction(fn () => DB::table(AccountProvisioning::TABLE)->insert($trusted));
            $this->fail('An existing immutable transition must not be overwritten or duplicated.');
        } catch (QueryException $error) {
            $this->assertSame('23505', $error->errorInfo[0]);
        }
        $this->assertSame(1, DB::table(AccountProvisioning::TABLE)
            ->where('user_account_id', $target->dd_user_account_id)->count());
        $this->assertNotNull(app(DataDictionaryIdentityResolver::class)->resolve($target));
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_summary_only_access_preflight_discloses_no_account_identifiers_and_never_writes(): void
    {
        $admin = $this->account('Admin', linked: false);
        $this->account('Engineer');
        $before = DB::table('jairoads_next.user_accounts')->orderBy('id')->get()->toJson();
        DB::commit();

        try {
            $this->assertSame(0, Artisan::call('jairoads:canonical-access-preflight', ['--summary' => true]));
            $output = trim(Artisan::output());
            $this->assertStringNotContainsString($admin->email, $output);
            $this->assertStringNotContainsString($admin->name, $output);
            $this->assertStringNotContainsString('account_id', $output);
            $summary = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
            $this->assertTrue($summary['provenance_available']);
            $this->assertSame(1, $summary['roles']['Admin']['total']);
            $this->assertSame(0, $summary['roles']['Admin']['eligible']);
            $this->assertSame(1, $summary['roles']['Admin']['needs_engineer_link']);
            $this->assertSame(1, $summary['roles']['Admin']['needs_reviewed_provisioning_evidence']);
            $this->assertSame(1, $summary['roles']['Engineer']['eligible']);
            $this->assertSame(1, $summary['roles']['SuperAdmin']['eligible']);
            $this->assertSame(0, $summary['legacy_only_login_count']);
            $this->assertSame($before, DB::table('jairoads_next.user_accounts')->orderBy('id')->get()->toJson());
        } finally {
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}
