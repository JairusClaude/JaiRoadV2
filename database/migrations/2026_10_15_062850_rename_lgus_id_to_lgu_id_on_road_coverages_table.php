<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('road_coverages', function (Blueprint $table): void {
            $table->dropForeign(['lgus_id']);
        });

        Schema::table('road_coverages', function (Blueprint $table): void {
            $table->renameColumn('lgus_id', 'lgu_id');
        });

        Schema::table('road_coverages', function (Blueprint $table): void {
            $table->foreign('lgu_id')
                ->references('id')
                ->on('lgus')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('road_coverages', function (Blueprint $table): void {
            $table->dropForeign(['lgu_id']);
        });

        Schema::table('road_coverages', function (Blueprint $table): void {
            $table->renameColumn('lgu_id', 'lgus_id');
        });

        Schema::table('road_coverages', function (Blueprint $table): void {
            $table->foreign('lgus_id')
                ->references('id')
                ->on('lgus')
                ->restrictOnDelete();
        });
    }
};
