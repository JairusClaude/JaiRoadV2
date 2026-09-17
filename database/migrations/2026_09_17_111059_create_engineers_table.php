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
        Schema::create('engineers', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('middle_name');
            $table->string('last_name');
            $table->string('email');
            $table->integer('contact_no');
            $table->string('rank');
            $table->string('position');
            $table->timestamps();

            $table->foreignId('lgus_id')  // [NEED RECONFIRMATION: NOT IN ERD]
                ->constrained('lgus');
            // $table->foreignId('created_by')     //POSSIBLE NOT NEEDED
            //     ->nullable();      // ->constrained('user_accounts');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('engineer');
    }
};
