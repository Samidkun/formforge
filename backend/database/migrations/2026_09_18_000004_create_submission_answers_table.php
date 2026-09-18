<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('submission_id')->constrained('submissions')->cascadeOnDelete();
            $table->string('field_key', 64);
            $table->jsonb('value')->nullable();
            $table->timestamps();

            $table->unique(['submission_id', 'field_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_answers');
    }
};
