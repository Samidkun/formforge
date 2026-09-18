<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_daily_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('form_id')->constrained('forms')->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('starts')->default(0);
            $table->unsignedInteger('completes')->default(0);
            $table->timestamps();

            $table->unique(['form_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_daily_stats');
    }
};
