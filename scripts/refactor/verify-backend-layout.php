<?php

declare(strict_types=1);

/**
 * Read-only verification for the backend folder/class refactor.
 *
 * No Composer install, migrations, network, database connection, CI, GitHub
 * Actions or paid services are invoked by this script.
 */
$root = dirname(__DIR__, 2);
$errors = [];
$checked = 0;
$linted = 0;

$oldIdentifiers = [
    'DdAuditHistoryController',
    'DdFrontendController',
    'DdOperationsController',
    'DdPeopleLifecycleController',
    'DdPhase3Controller',
    'DdPreservedHistoryController',
    'DdRoleDashboardController',
    'DdSectionController',
    'DdSuperAdminLandingController',
    'DataDictionaryIdentityResolver',
    'DdActivityNotifications',
    'DdAuditValues',
    'DdDashboardAnalytics',
    'DdOperationAudit',
    'DdRoleAccess',
    'ReadOnlyDdModel',
];
$oldNamespaces = [
    'App\\Http\\Controllers\\DataDictionary\\',
    'App\\Services\\DataDictionary\\',
    'App\\Models\\DataDictionary\\',
];

foreach (['app', 'routes', 'tests', 'bootstrap', 'config', 'database'] as $directory) {
    $source = $root.DIRECTORY_SEPARATOR.$directory;
    if (! is_dir($source)) {
        $errors[] = "Missing source directory: {$directory}";
        continue;
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if (! $file->isFile() || $file->getExtension() !== 'php') {
            continue;
        }
        $full = $file->getPathname();
        $path = str_replace('\\', '/', substr($full, strlen($root) + 1));
        $text = file_get_contents($full);
        if ($text === false) {
            $errors[] = "Cannot read: {$path}";
            continue;
        }
        $checked++;

        if (str_contains($path, '/DataDictionary/')) {
            $errors[] = "Legacy nested directory remains: {$path}";
        }
        foreach ($oldNamespaces as $old) {
            if (str_contains($text, $old)) {
                $errors[] = "Old namespace remains in {$path}: {$old}";
            }
        }
        foreach ($oldIdentifiers as $old) {
            if (preg_match('/\\b'.preg_quote($old, '/').'\\b/', $text)) {
                $errors[] = "Old class identifier remains in {$path}: {$old}";
            }
        }

        if (str_starts_with($path, 'app/')) {
            // Every app/ PHP class must keep its PSR-4 App namespace and class
            // basename in sync with its new file location.
            $relative = substr($path, strlen('app/'), -4);
            $parts = explode('/', $relative);
            $name = array_pop($parts);
            $expectedNamespace = 'App'.($parts ? '\\'.implode('\\', $parts) : '');
            if (! preg_match('/^namespace\\s+([^;]+);/m', $text, $ns)
                || trim($ns[1]) !== $expectedNamespace) {
                $errors[] = "PSR-4 namespace mismatch: {$path}";
            }
            if (! preg_match('/^\\s*(?:(?:final|abstract|readonly)\\s+)*(?:class|interface|trait|enum)\\s+([A-Za-z_][A-Za-z_0-9]*)/m', $text, $decl)
                || $decl[1] !== $name) {
                $errors[] = "Class/filename mismatch: {$path}";
            }
        }

        // Parse source with the exact PHP executable used by the operator.
        // Only read-only `php -l`; no file is executed.
        $command = escapeshellarg(PHP_BINARY).' -l '.escapeshellarg($full).' 2>&1';
        $output = [];
        $status = 1;
        exec($command, $output, $status);
        if ($status !== 0) {
            $errors[] = "PHP parse failure in {$path}: ".implode(' ', array_slice($output, 0, 2));
        } else {
            $linted++;
        }
    }
}

$web = file_get_contents($root.'/routes/web.php');
if ($web === false || ! str_contains($web, "require __DIR__.'/operations.php';")
    || ! str_contains($web, "require __DIR__.'/operations-pages.php';")
    || str_contains($web, "require __DIR__.'/dd-phase3.php';")
    || str_contains($web, "require __DIR__.'/dd-frontend.php';")) {
    $errors[] = 'Route include mapping was not fully updated';
}
foreach (['routes/operations.php', 'routes/operations-pages.php'] as $route) {
    if (! is_file($root.'/'.$route)) {
        $errors[] = "Missing relocated routes: {$route}";
    }
}

printf("Checked %d PHP files; parsed %d successfully.\\n", $checked, $linted);
if ($errors !== []) {
    foreach ($errors as $error) {
        fwrite(STDERR, "FAIL: {$error}\\n");
    }
    fwrite(STDERR, "Refactor is NOT verified. Do not deploy.\\n");
    exit(1);
}

echo "PASS: PHP syntax, PSR-4 class paths, removed namespaces and route include structure.\\n";
echo "NOTE: This does not prove app boot, database, browser acceptance or production readiness.\\n";
