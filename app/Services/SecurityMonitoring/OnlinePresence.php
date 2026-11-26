<?php

declare(strict_types=1);

namespace App\Services\SecurityMonitoring;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

/** Recent activity is an estimate, verified against live server sessions and eligibility. */
final class OnlinePresence
{
    /**
     * The request itself proves its authenticated session is active, even before
     * the outer telemetry middleware has persisted this request's activity.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $actor
     * @return array{available:bool,message:string,window_seconds:int,accounts:list<array<string,mixed>>,total:int}
     */
    public function readForRequest(Request $request, array $actor): array
    {
        if (! config('security-monitoring.enabled')) {
            return $this->read();
        }
        $user = $request->user();
        if (! $user instanceof User || ! $request->hasSession()
            || (string) $request->session()->get(Auth::guard('web')->getName()) !== (string) $user->getKey()
            || app(AccountIdentityResolver::class)->resolve($user) !== $actor) {
            return $this->read();
        }
        $username = DB::table('jairoads_next.user_accounts')->where('id', $actor['account_id'])->value('username');
        if (! is_string($username) || $username === '') {
            return $this->read();
        }
        $loginAt = $request->session()->get('security.login_at');
        $current = ['account_id' => (int) $actor['account_id'], 'username' => $username, 'account_type' => $actor['role'],
            'session_count' => 1, 'last_activity' => now()->utc()->toIso8601String(),
            'login_at' => is_string($loginAt) ? $loginAt : null,
            'client_description' => AuthenticationTelemetry::client($request), 'status' => 'Active', 'is_current' => true];
        $reference = SessionCatalog::reference($request->session()->getId());
        $result = $this->read($current, $reference);
        if (! $result['available']) {
            $result['accounts'] = [$current];
            $result['total'] = 1;
            $result['message'] .= ' Your authenticated session is shown; the status of other accounts is unavailable.';
        }

        return $result;
    }

    /**
     * @param  array{account_id:int,username:string,account_type:string,session_count:int,last_activity:string,login_at:?string,client_description:string,status:string,is_current:bool}|null  $current
     * @return array{available:bool,message:string,window_seconds:int,accounts:list<array<string,mixed>>,total:int}
     */
    public function read(?array $current = null, ?string $currentReference = null): array
    {
        $window = max(30, min(900, (int) config('security-monitoring.online_seconds', 300)));
        $result = ['available' => false, 'message' => 'Online presence requires approved monitoring tables and file/database sessions.',
            'window_seconds' => $window, 'accounts' => [], 'total' => 0];
        if (! config('security-monitoring.enabled')) {
            $result['message'] = 'Presence collection is disabled. Retained authentication history remains available.';

            return $result;
        }
        if (! app(AuthenticationTelemetry::class)->available()) {
            return $result;
        }
        try {
            $eligible = app(AccountIdentityResolver::class)->eligibleMonitoringLogins()
                ->select(['login.id as login_id', 'login.password', 'account.id as account_id', 'account.username', 'account.account_type']);
            $rows = DB::table(AuthenticationTelemetry::PRESENCE.' as presence')->joinSub($eligible, 'eligible', 'eligible.account_id', '=', 'presence.user_account_id')
                ->where('presence.last_activity', '>=', now()->subSeconds($window)->utc()->toIso8601String())
                ->limit((int) config('security-monitoring.max_recent_sessions') + 1)
                ->get(['presence.*', 'eligible.login_id', 'eligible.password', 'eligible.username', 'eligible.account_type']);
            if ($rows->count() > (int) config('security-monitoring.max_recent_sessions')) {
                throw new RuntimeException('Presence capacity exceeded.');
            }
            $wanted = [];
            foreach ($rows as $row) {
                if (hash_equals($row->credential_reference, SessionCatalog::reference($row->password, 'credential'))) {
                    $wanted[$row->session_reference] = ['login_id' => (int) $row->login_id] + SessionCatalog::credentialState($row->password);
                }
            }
            $live = array_flip(app(SessionCatalog::class)->liveReferences($wanted));
            $accounts = [];
            foreach ($rows as $row) {
                if (! isset($live[$row->session_reference])) {
                    continue;
                }
                $id = (int) $row->user_account_id;
                $last = CarbonImmutable::parse($row->last_activity, 'UTC')->utc();
                $login = $row->login_at === null ? null : CarbonImmutable::parse($row->login_at, 'UTC')->utc()->toIso8601String();
                if (! isset($accounts[$id])) {
                    $accounts[$id] = ['account_id' => $id, 'username' => $row->username, 'account_type' => $row->account_type,
                        'session_count' => 0, 'last_activity' => $last->toIso8601String(), 'login_at' => $login,
                        'client_description' => $row->client_description, 'status' => $last->greaterThanOrEqualTo(now()->subMinute()) ? 'Active' : 'Recently Active'];
                }
                $accounts[$id]['session_count']++;
                if ($last->greaterThan($accounts[$id]['last_activity'])) {
                    $accounts[$id]['last_activity'] = $last->toIso8601String();
                    $accounts[$id]['status'] = $last->greaterThanOrEqualTo(now()->subMinute()) ? 'Active' : 'Recently Active';
                    $accounts[$id]['client_description'] = $row->client_description;
                    $accounts[$id]['login_at'] = $login;
                }
            }
            if ($current !== null && $currentReference !== null) {
                $id = $current['account_id'];
                // Count each verified session once. The live request may not yet
                // be present in the recent-session catalogue.
                $count = ($accounts[$id]['session_count'] ?? 0) + (isset($live[$currentReference]) ? 0 : 1);
                $accounts[$id] = array_replace($current, ['session_count' => max(1, $count)]);
            }
            usort($accounts, static fn (array $a, array $b): int => [$b['last_activity'], $b['account_id']] <=> [$a['last_activity'], $a['account_id']]);

            return ['available' => true, 'message' => 'Estimated online presence from recent, currently valid sessions. Latest session shown for multiple devices.',
                'window_seconds' => $window, 'accounts' => $accounts, 'total' => count($accounts)];
        } catch (Throwable) {
            $result['message'] = 'Presence could not be fully verified: session driver, storage availability or capacity limit. No unverified accounts are shown.';

            return $result;
        }
    }
}
