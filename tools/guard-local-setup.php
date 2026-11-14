<?php

declare(strict_types=1);

use App\Services\LocalSetupGuard;
use Dotenv\Dotenv;

require __DIR__.'/../vendor/autoload.php';

$environment = [];
$path = __DIR__.'/../.env';
if (is_file($path)) {
    $environment = Dotenv::parse((string) file_get_contents($path));
}
foreach (['APP_ENV', 'JAIROADS_SCRATCH_APPROVAL', 'DB_CONNECTION', 'DB_HOST', 'DB_DATABASE', 'DB_URL', 'RENDER'] as $name) {
    $value = $_SERVER[$name] ?? $_ENV[$name] ?? getenv($name);
    if (is_string($value)) {
        $environment[$name] = $value;
    }
}
try {
    LocalSetupGuard::validate($environment);
} catch (RuntimeException $error) {
    // Neither DSNs nor credential values are printed.
    fwrite(STDERR, $error->getMessage().PHP_EOL);
    exit(64);
}
fwrite(STDOUT, 'Disposable local setup configuration verified; no database query was executed.'.PHP_EOL);
