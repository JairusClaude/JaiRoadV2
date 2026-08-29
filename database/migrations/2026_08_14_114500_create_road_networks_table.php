<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('road_networks', function (Blueprint $table) {
            $table->id();
            $table->timestamps();

            $table->foreignId('roads_id')
                ->constrained('roads');
            $table->foreignId('project_id')
                ->constrained('maintenance_projects');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('road_networks');
    }
};
