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
        Schema::create('maintenance_projects', function (Blueprint $table) {
            $table->id();
            $table->string('project_title');
            $table->text('description');
            $table->string('status');
            $table->date('start_date');
            $table->date('end_date');
            $table->integer('gravelled_road_in_km');
            $table->timestamps();

            $table->foreignId('lgus_id')
                ->constrained('lgus');
            $table->foreignId('engineers_id')
                ->constrained('engineers');
            $table->foreignId('created_by')
                ->constrained('user_accounts');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('maintenance_projects');
    }
};
