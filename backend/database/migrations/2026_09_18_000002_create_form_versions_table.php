<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('form_id')->constrained('forms')->cascadeOnDelete();
            $table->unsignedInteger('version_no');
            $table->jsonb('schema');
            $table->timestamp('published_at')->useCurrent();
            $table->timestamps();

            $table->unique(['form_id', 'version_no']);
        });

        Schema::table('forms', function (Blueprint $table) {
            $table->foreignUuid('current_version_id')->nullable()->constrained('form_versions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropForeign(['current_version_id']);
            $table->dropColumn('current_version_id');
        });

        Schema::dropIfExists('form_versions');
    }
};
