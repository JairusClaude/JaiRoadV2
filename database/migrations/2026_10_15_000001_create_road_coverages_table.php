<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // New whole coverages only. Never infer them from legacy road sections.
        Schema::create('road_coverages', function (Blueprint $table): void {
            $table->id();
            $table->string('road_name', 255);
            $table->foreignId('lgus_id')->constrained('lgus')->restrictOnDelete();
            $table->decimal('kilometers', 10, 2);
            $table->enum('pavement_type', ['Concrete', 'Asphalt', 'Gravel', 'Earth']);
            $table->enum('state_category', ['Good', 'Fair', 'Bad']);
            $table->jsonb('geojson');
            // Coverage attribution is an Engineer, unlike project attribution.
            $table->foreignId('created_by')->constrained('engineers')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Forward-only migration: use a reviewed corrective migration to preserve coverage data.');
    }
};
