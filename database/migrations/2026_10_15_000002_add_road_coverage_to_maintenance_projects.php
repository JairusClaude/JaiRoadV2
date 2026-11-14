<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_projects', function (Blueprint $table): void {
            // PostgreSQL allows multiple NULLs in an ordinary unique constraint.
            // NOT NULL is deferred until ALL existing projects are verified/mapped.
            $table->foreignId('road_coverage_id')->nullable()->unique()
                ->constrained('road_coverages')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Forward-only migration: do not remove verified project-to-coverage mappings.');
    }
};
