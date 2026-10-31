<?php

namespace App\Services\MaintenanceProjects;

use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class ProjectMutations
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    /** @param array<string, mixed> $data */
    public function create(User $user, array $data): MaintenanceProject
    {
        Gate::forUser($user)->authorize('create', MaintenanceProject::class);
        $actor = $this->accounts->require($user);

        return $this->coverageConflict(fn () => DB::transaction(function () use ($user, $data, $actor) {
            $this->availableCoverage($user, (int) $data['road_coverage_id']);

            return MaintenanceProject::create([
                'project_title' => $data['project_title'],
                'description' => $data['description'] ?? null,
                'road_coverage_id' => $data['road_coverage_id'],
                'created_by' => $actor->getKey(),
            ]);
        }));
    }

    /** @param array<string, mixed> $data */
    public function update(User $user, int $id, array $data): MaintenanceProject
    {
        return $this->coverageConflict(fn () => DB::transaction(function () use ($user, $id, $data) {
            $project = MaintenanceProject::query()->lockForUpdate()->findOrFail($id);
            Gate::forUser($user)->authorize('update', $project);
            $changed = (int) $data['road_coverage_id'] !== (int) $project->road_coverage_id;
            if ($changed && $project->maintenanceRecords()->exists()) {
                throw ValidationException::withMessages(['road_coverage_id' => 'Road coverage cannot be changed because this project has maintenance history.']);
            }
            if ($changed) {
                $this->availableCoverage($user, (int) $data['road_coverage_id'], $project->id);
            }
            $project->update([
                'project_title' => $data['project_title'],
                'description' => $data['description'] ?? null,
                'road_coverage_id' => $data['road_coverage_id'],
            ]);

            return $project;
        }));
    }

    /**
     * Individual and bulk deletion share the same atomic implementation.
     *
     * @param  array<int, int|string>  $ids
     */
    public function delete(User $user, array $ids): void
    {
        Gate::forUser($user)->authorize('deleteAny', MaintenanceProject::class);
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if (! $ids || count($ids) > 100 || min($ids) < 1) {
            throw ValidationException::withMessages(['project_ids' => 'Select between 1 and 100 valid projects.']);
        }
        try {
            DB::transaction(function () use ($user, $ids): void {
                // Parent FOR UPDATE locks conflict with PostgreSQL child FK
                // key-share locks. History cannot slip between this check and
                // deletion; restrictive foreign keys provide a second guard.
                $projects = MaintenanceProject::query()->whereKey($ids)->orderBy('id')->lockForUpdate()->get();
                if ($projects->count() !== count($ids)) {
                    throw ValidationException::withMessages(['project_ids' => 'One or more selected projects no longer exist. Refresh and select again.']);
                }
                foreach ($projects as $project) {
                    Gate::forUser($user)->authorize('delete', $project);
                }
                $blocked = [];
                $documentsExist = Schema::hasTable('project_documents');
                $updatesExist = Schema::hasTable('monthly_updates');
                foreach ($projects as $project) {
                    $reason = $project->maintenanceRecords()->exists() ? 'maintenance history' : null;
                    if (! $reason && (($documentsExist && $project->projectDocuments()->exists())
                        || ($updatesExist && $project->monthlyUpdates()->exists()))) {
                        $reason = 'related historical information';
                    }
                    if ($reason) {
                        $blocked[] = '#'.$project->id.' '.$project->project_title.' ('.$reason.')';
                    }
                }
                if ($blocked) {
                    throw ValidationException::withMessages(['project_ids' => 'Nothing was deleted. Deletion is blocked for: '.implode('; ', $blocked).'. Remove these projects from your selection.']);
                }
                // Never delete coverages, child records, updates, or files.
                foreach ($projects as $project) {
                    $project->delete();
                }
            });
        } catch (QueryException $exception) {
            if ($exception->getCode() !== '23503' && ! str_contains($exception->getMessage(), 'FOREIGN KEY constraint failed')) {
                throw $exception;
            }
            throw ValidationException::withMessages(['project_ids' => 'Nothing was deleted. A selected project has related historical information or new maintenance history. Refresh and adjust your selection.']);
        }
    }

    private function availableCoverage(User $user, int $id, ?int $except = null): void
    {
        $coverage = RoadCoverage::query()->lockForUpdate()->find($id);
        if (! $coverage) {
            throw ValidationException::withMessages(['road_coverage_id' => 'This road coverage is no longer available. Choose another coverage.']);
        }
        Gate::forUser($user)->authorize('assignCoverage', [MaintenanceProject::class, $coverage]);
        if (MaintenanceProject::query()->where('road_coverage_id', $id)->when($except, fn ($query) => $query->whereKeyNot($except))->exists()) {
            throw ValidationException::withMessages(['road_coverage_id' => 'This road coverage is already assigned to another project. Choose an available coverage.']);
        }
    }

    private function coverageConflict(callable $action): MaintenanceProject
    {
        try {
            return $action();
        } catch (UniqueConstraintViolationException $exception) {
            if (! str_contains($exception->getMessage(), 'road_coverage_id')) {
                throw $exception;
            }
            throw ValidationException::withMessages(['road_coverage_id' => 'This road coverage was assigned to another project. Choose an available coverage.']);
        }
    }
}
