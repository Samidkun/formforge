<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('form_id')->constrained('forms')->cascadeOnDelete();
            $table->uuid('session_id');
            $table->string('type', 32);
            $table->string('field_key', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['form_id', 'type']);
            $table->index(['form_id', 'created_at']);
            $table->index('session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_events');
    }
};
