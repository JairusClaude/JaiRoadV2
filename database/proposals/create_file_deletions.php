<?php

// REVIEW ONLY. Outside Laravel's automatic migration path. Schema-owner approval
// is required before copying/executing this forward-only proposal on shared data.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            Schema::create('jairoads_next.file_deletions', function (Blueprint $table): void {
                $table->bigIncrements('id');
                $table->string('kind', 20);
                $table->bigInteger('entity_id');
                $table->bigInteger('requested_by');
                $table->bigInteger('initiated_by');
                $table->string('actor_role', 20);
                $table->string('actor_identifier');
                $table->bigInteger('maintenance_id');
                $table->bigInteger('monthly_update_id')->nullable();
                $table->string('file_name');
                $table->text('object_path')->nullable();
                $table->text('storage_origin')->nullable();
                $table->string('bucket')->nullable();
                $table->string('state', 20)->default('pending');
                $table->integer('attempts')->default(0);
                $table->string('last_error_code', 40)->nullable();
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('completed_at')->nullable();
                $table->foreign('initiated_by')->references('id')->on('jairoads_next.user_accounts')->restrictOnDelete();
                $table->foreign('requested_by')->references('id')->on('jairoads_next.user_accounts')->restrictOnDelete();
                $table->unique(['kind', 'entity_id']);
                $table->index(['state', 'attempts', 'id']);
            });
            DB::statement("ALTER TABLE jairoads_next.file_deletions ADD CONSTRAINT file_deletions_state_ck CHECK (state IN ('pending','completed')), ADD CONSTRAINT file_deletions_kind_ck CHECK (kind IN ('document','media')), ADD CONSTRAINT file_deletions_actor_ck CHECK (actor_role IN ('Admin','SuperAdmin')), ADD CONSTRAINT file_deletions_target_ck CHECK (state = 'completed' OR (object_path IS NOT NULL AND storage_origin IS NOT NULL AND bucket IS NOT NULL))");
            DB::statement('ALTER TABLE jairoads_next.file_deletions ENABLE ROW LEVEL SECURITY');
            DB::statement('REVOKE ALL ON jairoads_next.file_deletions FROM PUBLIC');
            DB::statement('REVOKE ALL ON SEQUENCE jairoads_next.file_deletions_id_seq FROM PUBLIC');
            DB::unprepared(<<<'SQL'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON jairoads_next.file_deletions FROM anon;
    REVOKE ALL ON SEQUENCE jairoads_next.file_deletions_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON jairoads_next.file_deletions FROM authenticated;
    REVOKE ALL ON SEQUENCE jairoads_next.file_deletions_id_seq FROM authenticated;
  END IF;
END $$;
SQL);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Deletion intent history requires an explicit schema-owner retention/recovery plan; automatic rollback is prohibited.');
    }
};
