<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountProvisioning;
use App\Services\AccountIdentityResolver;
use App\Services\TrustedSuperAdminBootstrap;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class ProvisioningEvidenceTest extends PostgresTestCase
{
    public static function immutableOperations(): iterable
    {
        yield ['UPDATE jairoads_security.account_provisioning SET provisioned_by = user_account_id'];
        yield ['DELETE FROM jairoads_security.account_provisioning'];
        yield ['TRUNCATE jairoads_security.account_provisioning'];
    }

    #[DataProvider('immutableOperations')]
    public function test_history_is_immutable_even_for_the_test_table_owner(string $sql): void
    {
        $this->account('Viewer');
        $before = DB::table(AccountProvisioning::TABLE)->get()->toJson();
        try {
            DB::transaction(fn () => DB::statement($sql));
            $this->fail('Provisioning history must not be rewritten.');
        } catch (QueryException $e) {
            $this->assertSame('42501', $e->errorInfo[0]);
        }
        $this->assertSame($before, DB::table(AccountProvisioning::TABLE)->get()->toJson());
    }

    public function test_later_provisioner_deactivation_does_not_rewrite_or_revoke_the_childs_provenance(): void
    {
        $child = $this->account('Engineer');
        $evidence = DB::table(AccountProvisioning::TABLE)->where('user_account_id', $child->dd_user_account_id)->first();
        DB::table('jairoads_next.user_accounts')->where('id', $evidence->provisioned_by)->update(['is_active' => false]);
        $this->assertNotNull(app(AccountIdentityResolver::class)->resolve($child));
        $this->assertEquals($evidence, DB::table(AccountProvisioning::TABLE)->where('user_account_id', $child->dd_user_account_id)->first());
    }

    public function test_forged_provenance_provisioner_cannot_create_evidence(): void
    {
        $actor = $this->account('Viewer');
        $target = $this->account('Engineer', $this->engineer(), linked: false);
        try {
            DB::transaction(fn () => DB::table(AccountProvisioning::TABLE)->insert([
                'user_account_id' => $target->dd_user_account_id, 'provisioned_by' => $actor->dd_user_account_id,
                'provisioner_role' => 'Admin', 'provisioned_role' => 'Engineer',
                'engineer_id' => DB::table('jairoads_next.user_accounts')->where('id', $target->dd_user_account_id)->value('engineer_id'), 'method' => 'administrator',
            ]));
            $this->fail('An invented administrator cannot attest an account.');
        } catch (QueryException $e) {
            $this->assertSame('23514', $e->errorInfo[0]);
        }
        $this->assertNull(app(AccountIdentityResolver::class)->resolve($target));
    }

    public function test_bootstrap_rolls_back_canonical_identity_when_fortify_insert_fails(): void
    {
        DB::connection()->beforeExecuting(static function (string $sql): void {
            if (str_starts_with($sql, 'insert into "public"."users"')) {
                throw new \RuntimeException('Disposable Fortify write failure');
            }
        });
        try {
            app(TrustedSuperAdminBootstrap::class)->create('root', 'root@example.test', 'Root', 'Synthetic-Bootstrap!123');
            $this->fail('Injected failure must abort bootstrap.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Disposable Fortify write failure', $e->getMessage());
        }
        $this->assertSame(0, User::count());
        $this->assertSame(0, DB::table('jairoads_next.user_accounts')->count());
    }

    public function test_bootstrap_rejects_a_nonprivileged_database_operator(): void
    {
        DB::statement('CREATE ROLE jairoads_bootstrap_unprivileged NOLOGIN');
        DB::statement('SET LOCAL ROLE jairoads_bootstrap_unprivileged');
        try {
            app(TrustedSuperAdminBootstrap::class)->create('root', 'root@example.test', 'Root', 'Synthetic-Bootstrap!123');
            $this->fail('Unprivileged database roles cannot bootstrap a root.');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        } finally {
            DB::statement('RESET ROLE');
        }
        $this->assertSame(0, User::count());
        $this->assertSame(0, DB::table('jairoads_next.user_accounts')->count());
    }

    public function test_cli_bootstrap_has_no_noninteractive_default_and_preflight_is_read_only(): void
    {
        $this->artisan('jairoads:bootstrap-superadmin')->expectsQuestion('Type TRUSTED DATABASE OPERATOR to proceed', 'no')->assertFailed();
        $this->account('Viewer');
        $before = DB::table('jairoads_next.user_accounts')->get()->toJson();
        // Preflight owns a top-level read-only transaction, not our fixture transaction.
        DB::commit();
        try {
            $this->artisan('jairoads:canonical-access-preflight')->assertSuccessful();
            $this->assertSame($before, DB::table('jairoads_next.user_accounts')->get()->toJson());
        } finally {
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}
