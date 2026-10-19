<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('maintenance_documents')) {
            throw new RuntimeException('maintenance_documents already exists; inspect it before applying this migration.');
        }

        Schema::create('maintenance_documents', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignId('maintenance_id');
            $table->string('document_title', 255);
            $table->text('description')->nullable();
            $table->string('file_name', 255);
            $table->string('file_path', 500);
            $table->foreignId('uploaded_by');
            $table->timestampTz('uploaded_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
            $table->foreign('maintenance_id', 'md_maintenance_id_fk')
                ->references('id')->on('maintenance_records')->restrictOnDelete();
            $table->foreign('uploaded_by', 'md_uploaded_by_fk')
                ->references('id')->on('user_accounts')->restrictOnDelete();
            $table->index(['maintenance_id', 'uploaded_at'], 'md_record_uploaded_idx');
        });
    }

    public function down(): void
    {
        // Shared production data must not be destroyed by an automatic rollback.
        throw new RuntimeException('Never automatically drop maintenance_documents; request a reviewed data-retention rollback.');
    }
};
