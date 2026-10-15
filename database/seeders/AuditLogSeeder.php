<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\MaintenanceProject;
use App\Models\ProjectDocument;
use App\Models\Road;
use App\Models\UserAccount;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AuditLogSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        DB::transaction(function (): void {
            $actor = UserAccount::factory()->create([
                'accountType' => 'admin',
                'is_active' => true,
            ]);

            $project = MaintenanceProject::factory()->create([
                'created_by' => $actor->getKey(),
                'status' => 'Pending',
            ]);

            AuditLog::factory()->forChange(
                $project,
                'created',
                null,
                $project->only([
                    'project_title',
                    'description',
                    'status',
                    'start_date',
                    'end_date',
                    'gravelled_road_in_km',
                    'lgus_id',
                    'engineers_id',
                    'created_by',
                ]),
                $actor
            )->create();

            $projectBefore = $project->only(['status', 'description']);

            $project->update([
                'status' => 'Ongoing',
                'description' => 'Patching and drainage repairs are in progress.',
            ]);

            AuditLog::factory()->forChange(
                $project,
                'updated',
                $projectBefore,
                $project->only(['status', 'description']),
                $actor
            )->create();

            $road = Road::factory()->create([
                'created_by' => $actor->getKey(),
                'lgus_id' => $project->lgus_id,
            ]);

            $oldGeometry = $road->geojsondata;
            $newGeometry = json_encode([
                'type' => 'LineString',
                'coordinates' => [
                    [125.40, 7.50],
                    [125.41, 7.51],
                ],
            ], JSON_THROW_ON_ERROR);

            $road->update(['geojsondata' => $newGeometry]);

            AuditLog::factory()->forChange(
                $road,
                'updated',
                ['geojsondata' => $oldGeometry],
                ['geojsondata' => $road->geojsondata],
                $actor
            )->create();

            $document = ProjectDocument::factory()->create([
                'maintenance_projects_id' => $project->getKey(),
                'uploaded_by' => $actor->getKey(),
            ]);

            $documentValues = $document->only([
                'document_title',
                'description',
                'file_name',
                'file_path',
                'maintenance_projects_id',
                'uploaded_by',
            ]);

            AuditLog::factory()->forChange(
                $document,
                'created',
                null,
                $documentValues,
                $actor
            )->create();

            $document->delete();

            AuditLog::factory()->forChange(
                $document,
                'deleted',
                $documentValues,
                null,
                $actor
            )->create();
        });
    }
}