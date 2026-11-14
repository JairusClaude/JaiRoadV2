<?php

use Symfony\Component\HttpFoundation\Request;

test('rendered login assets retain legitimate request and proxy authority', function (string $url, array $headers, string $expected): void {
    $response = $this->get($url, $headers)->assertOk();
    preg_match_all('/(?:href|src)="([^"]*\/build\/assets\/[^\"]+)"/', $response->getContent(), $assets);
    expect(count($assets[1]))->toBeGreaterThanOrEqual(2);
    foreach ($assets[1] as $asset) {
        $parts = parse_url($asset);
        $authority = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        expect($authority)->toBe($expected);
    }
})->with([
    'local port' => ['http://127.0.0.1:10000/login', [], 'http://127.0.0.1:10000'],
    'TLS origin' => ['https://portal.example.test/login', [], 'https://portal.example.test'],
    'trusted ingress' => ['http://internal.example.test/login', ['X-Forwarded-Host' => 'portal.example.test', 'X-Forwarded-Proto' => 'https', 'X-Forwarded-Port' => '443'], 'https://portal.example.test'],
]);

test('crafted front-controller base paths cannot supply an asset host', function (): void {
    $request = Request::create('https://portal.example.test//wrong-origin.example.test/public/index.php/login', 'GET', server: [
        'SCRIPT_NAME' => '/public/index.php', 'SCRIPT_FILENAME' => '/app/public/index.php',
    ]);
    expect($request->getBaseUrl())->toBe('')->and($request->getSchemeAndHttpHost())->toBe('https://portal.example.test');
});
