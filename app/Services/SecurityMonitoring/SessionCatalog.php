<?php

declare(strict_types=1);

namespace App\Services\SecurityMonitoring;

use Illuminate\Session\EncryptedStore;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;

/** Read existing session infrastructure; never copy reusable IDs into telemetry. */
final class SessionCatalog
{
    public static function reference(string $value, string $purpose = 'session'): string
    {
        return hash_hmac('sha256', $purpose.':'.$value, (string) config('app.key'));
    }

    /** @return array{credential:string,session_credential:string} */
    public static function credentialState(string $password): array
    {
        $guard = Auth::guard();

        return ['credential' => self::reference($password, 'credential'), 'session_credential' => self::reference($guard->hashPasswordForCookie($password), 'credential')];
    }

    /** @param array<string,array{login_id:int,credential:string,session_credential:string}> $wanted verified identity and non-reusable credential reference
     * @return list<string>
     */
    public function liveReferences(array $wanted): array
    {
        $driver = config('session.driver');
        if (! in_array($driver, ['file', 'database'], true)) {
            throw new \RuntimeException('Presence supports file and database sessions only.');
        }
        $store = Session::driver();
        $ids = [];
        if ($driver === 'database') {
            $connection = DB::connection(config('session.connection'));
            $ids = $connection->table((string) config('session.table', 'sessions'))
                ->where('last_activity', '>=', now()->subSeconds(min(max(30, min(900, (int) config('security-monitoring.online_seconds'))), (int) config('session.lifetime') * 60))->timestamp)
                ->limit((int) config('security-monitoring.max_session_files') + 1)->pluck('id')->all();
        } else {
            $directory = new \FilesystemIterator((string) config('session.files'), \FilesystemIterator::SKIP_DOTS);
            foreach ($directory as $file) {
                if ($file instanceof \SplFileInfo && $file->isFile() && ! $file->isLink()) {
                    $ids[] = $file->getFilename();
                    if (count($ids) > (int) config('security-monitoring.max_session_files')) {
                        break;
                    }
                }
            }
        }
        if (count($ids) > (int) config('security-monitoring.max_session_files')) {
            throw new \RuntimeException('Presence verification capacity exceeded.');
        }
        $valid = [];
        foreach ($ids as $id) {
            if (! is_string($id) || ! preg_match('/\A[a-zA-Z0-9]{40}\z/', $id)) {
                continue;
            }
            $reference = self::reference($id);
            if (! isset($wanted[$reference])) {
                continue;
            }
            if ($this->matchesSession($id, $wanted[$reference])) {
                $valid[] = $reference;
            }
        }

        return $valid;
    }

    /** Read-back of a known current ID is O(1); presence scan limits must not disable login history.
     * @param  array{login_id:int,credential:string,session_credential:string}  $expected
     */
    public function matchesSession(string $id, array $expected): bool
    {
        $store = Session::driver();
        $handler = clone $store->getHandler();
        if (! $handler instanceof \SessionHandlerInterface) {
            throw new \RuntimeException('Unsupported session handler.');
        }
        $probe = $store instanceof EncryptedStore
            ? new EncryptedStore($store->getName(), $handler, app('encrypter'), $id, config('session.serialization', 'php'))
            : new Store($store->getName(), $handler, $id, config('session.serialization', 'php'));
        $probe->start();
        $password = $probe->get('password_hash_'.Auth::getDefaultDriver());
        $credential = is_string($password) ? self::reference($password, 'credential') : $probe->get('security.credential');

        return (string) $probe->get(Auth::guard()->getName()) === (string) $expected['login_id']
            && is_string($credential) && (hash_equals($expected['credential'], $credential) || hash_equals($expected['session_credential'], $credential));
    }
}
