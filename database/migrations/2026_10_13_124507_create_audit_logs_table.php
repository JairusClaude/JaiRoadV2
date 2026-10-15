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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('actor_identifier');
            $table->string('action');
            $table->string('entity_type');
            $table->bigInteger('entity_id');
            $table->text('description');

            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();

            $table->text('notification_message');

            $table->foreignId('user_id')
                ->nullable() // Add this if some logs are system-generated
                ->constrained('user_accounts');

            $table->foreignId('recipient_user_id')
                ->nullable() // Add this if not every action has a recipient user
                ->constrained('user_accounts');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
