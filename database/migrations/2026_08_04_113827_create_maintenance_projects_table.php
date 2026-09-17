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

            $table->foreignId('lgu_id')
                ->constrained('lgu');
            $table->foreignId('engineer_id')
                ->constrained('engineer');
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
