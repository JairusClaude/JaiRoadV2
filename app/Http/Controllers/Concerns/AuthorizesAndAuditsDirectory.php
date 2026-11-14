<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\OperationAudit;
use App\Services\RoleAccess;
use Illuminate\Http\Request;

/**
 * Shared canonical identity, administrator authorization and system audit helpers.
 * Method bodies are relocated from DirectoryController without changing behavior.
 */
trait AuthorizesAndAuditsDirectory
{
    /**
     * @return array{account_id:int,role:string,engineer_id:?int}
     */
    private function identity(Request $request, AccountIdentityResolver $resolver): array
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->getAttribute('dd_user_account_id') !== null, 403);
        $identity = $resolver->resolve($user);
        abort_unless($identity !== null, 403, 'Your account is unavailable. Please contact your administrator.');

        return $identity;
    }

    /**
     * @return array{account_id:int,role:string,engineer_id:?int}
     */
    protected function admin(Request $request, AccountIdentityResolver $resolver): array
    {
        $id = $this->identity($request, $resolver);
        abort_unless(RoleAccess::canManageAccounts($id['role']), 403);

        return $id;
    }

    /**
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @param  array<string,mixed>  $details
     * @param  array<string,mixed>  $old
     */
    protected function audit(array $actor, string $action, string $entity, int $recordId, string $description, array $details, array $old = []): void
    {
        app(OperationAudit::class)->record($actor, $action, $entity, $recordId, $description, $details, $old);
    }
}
