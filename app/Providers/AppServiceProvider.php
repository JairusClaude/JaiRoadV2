<?php

namespace App\Providers;

use App\Auth\LinkedPasswordUserProvider;
use App\Services\SecurityMonitoring\SessionCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

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
        Event::listen(Logout::class, static function (Logout $event): void {
            Inertia::clearHistory();
            $request = app('request');
            if ($event->guard === 'web' && $request->hasSession() && $request->routeIs('logout')) {
                $request->attributes->set('security.logout', $event->user);
                $request->attributes->set('security.logout_reference', SessionCatalog::reference($request->session()->getId()));
            }
        });
        Auth::provider('dd-linked-eloquent', function ($app, array $config): LinkedPasswordUserProvider {
            return new LinkedPasswordUserProvider($app['hash'], $config['model']);
        });
        $this->configureDefaults();
        // Authentication telemetry is outside canonical business auditing.
        Event::listen(Login::class, static function (Login $event): void {
            Inertia::clearHistory();
            $request = app('request');
            if ($event->guard === 'web' && $request->hasSession()) {
                $request->attributes->set('security.login', true);
                $request->session()->put('security.login_at', now()->utc()->toIso8601String());
                $request->session()->put('security.credential', SessionCatalog::reference($event->user->getAuthPassword(), 'credential'));
            }
        });
        Event::listen(Failed::class, static function (Failed $event): void {
            $request = app('request');
            if ($event->guard === 'web') {
                // Do not read the event's credential array or attribute an unverified user.
                $request->attributes->set('security.failed', true);
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
