<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('form_id')->constrained('forms')->cascadeOnDelete();
            $table->foreignUuid('form_version_id')->constrained('form_versions')->cascadeOnDelete();
            $table->uuid('session_id');
            $table->string('status', 20)->default('partial'); // partial | complete
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->jsonb('meta')->nullable();
            $table->timestamps();

            $table->unique(['form_id', 'session_id']);
            $table->index(['form_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};
