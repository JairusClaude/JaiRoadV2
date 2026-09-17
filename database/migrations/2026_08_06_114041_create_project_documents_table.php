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
        Schema::create('project_documents', function (Blueprint $table) {
            $table->id();
            $table->string('document_title');
            $table->text('description');
            $table->string('file_name');
            $table->string('file_path');
            $table->timestamps();

            $table->foreignId('project_id')
                ->constrained('maintenance_projects');
            $table->foreignId('uploaded_by')
                ->constrained('user_accounts');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_documents');
    }
};
