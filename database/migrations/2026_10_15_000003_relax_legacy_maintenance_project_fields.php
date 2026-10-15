<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Prepared against migration source only. Verify actual types/defaults/FKs
        // before execution. Keep all historical values and existing FK constraints.
        Schema::table('maintenance_projects', function (Blueprint $table): void {
            $table->text('description')->nullable()->change();
            $table->string('status')->nullable()->change();
            $table->date('start_date')->nullable()->change();
            $table->date('end_date')->nullable()->change();
            $table->integer('gravelled_road_in_km')->nullable()->change();
            $table->unsignedBigInteger('lgus_id')->nullable()->change();
            $table->unsignedBigInteger('engineers_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Forward-only migration: restoring NOT NULL could invalidate newly created projects.');
    }
};
