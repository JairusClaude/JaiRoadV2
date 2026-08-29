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
        Schema::create('roads', function (Blueprint $table) {
            $table->id();
            $table->string('road_name');
            $table->integer('kilometers');
            $table->string('geojsondata');
            $table->timestamps();

            $table->foreignId('created_by')
                ->constrained('user_accounts');
            $table->foreignId('lgu_id')
                ->constrained('lgu');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roads');
    }
};
