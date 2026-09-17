<?php
// backend/database/migrations/2026_09_17_000001_create_workspaces_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            // NOTE (plan defect, see task-4-report.md): the brief specifies
            // `foreignUuid('owner_id')`, but `users.id` is the Laravel default
            // `bigint` (brief: "Consumes: users (bawaan Laravel)"). Postgres
            // rejects that FK ("incompatible types: uuid and bigint"), and both
            // the tests and Task 5 insert `owner_id => $user->id`. So owner_id
            // must match users.id: `foreignId` (bigint), not uuid.
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
            $table->index('owner_id');
        });
    }
    public function down(): void { Schema::dropIfExists('workspaces'); }
};
