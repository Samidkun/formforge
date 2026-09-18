<?php
// backend/database/migrations/2026_09_18_000001_create_forms_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('forms', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            // NOTE: workspaces.id IS a uuid (HasUuids), so foreignUuid is correct
            // here. Contrast with workspaces.owner_id (Plan 1, ruling T4-1) which
            // had to be foreignId because users.id is the Laravel default bigint.
            $table->foreignUuid('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('status')->default('draft');   // draft|published|closed
            $table->jsonb('draft_schema')->default('{"fields":[]}');
            $table->jsonb('settings')->default('{}');
            $table->timestamps();
            $table->index('workspace_id');
        });
    }

    public function down(): void { Schema::dropIfExists('forms'); }
};
