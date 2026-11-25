<?php

declare(strict_types=1);

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Contracts\ControllerDispatcher;
use Illuminate\Support\Facades\Route;
use Inertia\Response as InertiaResponse;

// Derive exact, unnamed aliases from the canonical declarations. Wayfinder
// generates links only for the canonical actions and named routes.
foreach (Route::getRoutes()->getRoutes() as $canonical) {
    if (! str_starts_with($canonical->uri(), 'workspace/')) {
        continue;
    }

    $controller = $canonical->getControllerClass();
    $method = $canonical->getActionMethod();
    if ($method === $controller) {
        $method = '__invoke';
    }
    $alias = Route::match($canonical->methods(), 'dd-phase3'.substr($canonical->uri(), strlen('workspace')), static function (Request $request) use ($controller, $method) {
        // Already-open forms can submit a former return URL. The controller
        // still checks the rewritten relative destination against its allowlist.
        foreach ([$request->query, $request->isJson() ? $request->json() : $request->request] as $input) {
            $returnTo = $input->all()['return_to'] ?? null;
            if (is_string($returnTo) && str_starts_with($returnTo, '/dd-phase3/')) {
                $input->set('return_to', '/workspace'.substr($returnTo, strlen('/dd-phase3')));
            }
        }

        $status = $request->session()->get('dd_operations_status');
        $response = app(ControllerDispatcher::class)->dispatch($request->route(), app($controller), $method);

        // Authorize the original read before redirecting. JSON and file
        // responses, errors, and write responses pass through unchanged.
        if (($request->isMethod('GET') || $request->isMethod('HEAD'))
            && ($response instanceof InertiaResponse || $response instanceof RedirectResponse)) {
            $request->session()->reflash();
            if ($status !== null && ! $request->session()->has('dd_operations_status')) {
                $request->session()->flash('dd_operations_status', $status);
            }

            return redirect('/workspace'.substr($request->decodedPath(), strlen('dd-phase3'))
                .($request->server->get('QUERY_STRING') ? '?'.$request->server->get('QUERY_STRING') : ''),
                302, ['Cache-Control' => 'private, no-store']);
        }

        return $response;
    })->middleware($canonical->gatherMiddleware())
        ->withoutMiddleware($canonical->excludedMiddleware())
        ->where($canonical->wheres)
        ->setBindingFields($canonical->bindingFields());

    foreach ($canonical->defaults as $key => $value) {
        $alias->defaults($key, $value);
    }
}
