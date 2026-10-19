<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Auth\Events\Login;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\DdActivityNotifications;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        // Fortify dispatches Login after successful authentication. Log only
        // DD-linked successful sign-ins; legacy credentials remain unchanged.
        Event::listen(Login::class, function (Login $event): void {
            if (! $event->user instanceof User || $event->user->getAttribute('dd_user_account_id') === null) {
                return;
            }
            try {
                $identity = app(DataDictionaryIdentityResolver::class)->resolve($event->user);
                if ($identity === null) {
                    return;
                }
                DB::transaction(static function () use ($identity): void {
                    DB::table('jairoads_next.audit_logs')->insert([
                        'user_id' => $identity['account_id'],
                        'actor_identifier' => 'DD-UserAccount#'.$identity['account_id'],
                        'action' => 'LOGIN', 'entity_type' => 'UserAccount',
                        'entity_id' => $identity['account_id'],
                        'description' => 'Successful DD user login.',
                        'old_value' => null, 'new_value' => null,
                        'recipient_user_id' => null, 'notification_message' => null,
                        'created_at' => now(),
                    ]);
                    app(DdActivityNotifications::class)->record($identity, 'LOGIN', 'UserAccount', (int) $identity['account_id'], 'Successful login');
                });
            } catch (\Throwable $exception) {
                // An unavailable AuditLog must not turn a valid sign-in into a
                // failed login. Record server-side error for investigation.
                report($exception);
            }
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
