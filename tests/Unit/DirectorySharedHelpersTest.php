<?php

declare(strict_types=1);

use App\Http\Controllers\CanonicalAccountProvisioningController;
use App\Http\Controllers\Concerns\AuthorizesAndAuditsDirectory;
use App\Http\Controllers\Controller;
use App\Http\Controllers\DirectoryController;
use App\Http\Controllers\EngineerAssignmentController;
use App\Http\Controllers\EngineerDirectoryController;
use App\Http\Controllers\LguDirectoryController;

it('shares exact canonical directory helpers without controller inheritance', function (): void {
    $controllers = [
        DirectoryController::class,
        LguDirectoryController::class,
        EngineerDirectoryController::class,
        EngineerAssignmentController::class,
        CanonicalAccountProvisioningController::class,
    ];

    foreach ($controllers as $class) {
        expect(is_subclass_of($class, Controller::class))->toBeTrue();
        expect(class_uses($class))->toContain(AuthorizesAndAuditsDirectory::class);
        expect((new ReflectionMethod($class, 'identity'))->isPrivate())->toBeTrue();
        expect((new ReflectionMethod($class, 'admin'))->isProtected())->toBeTrue();
        expect((new ReflectionMethod($class, 'audit'))->isProtected())->toBeTrue();
    }

    foreach (array_slice($controllers, 1) as $class) {
        expect(is_subclass_of($class, DirectoryController::class))->toBeFalse();
    }
});
