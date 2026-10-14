<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();

            $table->foreignId('maintenance_projects_id')
                ->constrained('maintenance_projects');

            $table->foreignId('engineers_id')
                ->constrained('engineers');

            $table->smallInteger('maintenance_year');
            $table->string('quarter', 2);
            $table->date('start_date');
            $table->integer('estimated_duration_days');
            $table->date('complete_date')->nullable();
            $table->string('status');
            $table->text('description');

            $table->foreignId('created_by')
                ->constrained('user_accounts');

            $table->timestamps();

            $table->index([
                'maintenance_projects_id',
                'maintenance_year',
                'quarter',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_records');
    }
};
