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
        Schema::create('monthly_updates', function (Blueprint $table) {
            $table->id();
            $table->date('update_month');
            $table->integer('progress_percentage');
            $table->text('summary_of_text_reports');
            $table->timestamps('');

        $table->foreignId('created_by')
            ->constrained('user_accounts');
        $table->foreignId('maintenance_projects_id')
            ->constrained('maintenance_projects');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('monthly_updates');
    }
};
