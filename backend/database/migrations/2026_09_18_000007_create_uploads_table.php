<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('uploads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('form_id')->nullable()->constrained('forms')->nullOnDelete();
            $table->foreignUuid('submission_id')->nullable()->constrained('submissions')->nullOnDelete();
            $table->string('filename');
            $table->string('mime', 128);
            $table->unsignedBigInteger('size');
            $table->string('storage_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uploads');
    }
};
