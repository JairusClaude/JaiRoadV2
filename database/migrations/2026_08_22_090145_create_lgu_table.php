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
        Schema::create('lgu', function (Blueprint $table) {
            $table->id();
            $table->string('municipality_name');
            $table->string('province');
            $table->string('region');
            $table->string('contact_no');
            $table->string('mayor_first_name');
            $table->string('mayor_middle_name');
            $table->string('mayor_last_name');
            $table->timestamps('');

        $table->foreignId('created_by')
            ->constrained('user_accounts');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lgu');
    }
};
