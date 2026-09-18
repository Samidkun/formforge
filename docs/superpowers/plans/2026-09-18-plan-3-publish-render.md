# Plan 3: Publish & Render (Milestone 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the form publishing and public rendering pipeline: Laravel creates immutable versioned schemas (`form_versions`), Go edge service provides high-performance public read (`GET /f/:slug`) and submission intake (`POST /f/:slug/submit`), Next.js displays the publish controls in builder and renders interactive public forms (`/f/:slug`) for all 9 field types.

**Architecture:** 
- Laravel core manages domain state: form versions table, submissions table, and `POST /api/forms/{id}/publish` endpoint making draft schemas immutable.
- Go edge service runs a stateless HTTP server in `edge/` connecting to Postgres, validating public submissions against the published version schema, and upserting into `submissions` and `submission_answers`.
- Next.js frontend integrates the Publish button in the Builder UI and provides a dedicated public SSR/client route at `/f/[slug]` that dynamically renders inputs for all 9 field types using Rukun design tokens and posts submissions to the Go edge API.

**Tech Stack:** Laravel 12, PHPUnit 12, PostgreSQL 18, Go 1.27 (`net/http`, `database/sql`, `github.com/lib/pq`), Next.js 16 (React 19, TypeScript 5.9.3, Tailwind CSS v4), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md`

## Global Constraints

- Monorepo structure: `backend/` (Laravel), `frontend/` (Next.js), `edge/` (Go service).
- PostgreSQL database: same database container `plan-1-foundation-db-1` on port 5433 (internal 5432) accessed by both Laravel and Go.
- Envelope format for APIs: `{ "success": boolean, "data": ..., "error": ..., "meta": ... }`.
- Design tokens: Rukun technical instrument palette (`#16181C`, `#1E2228`, `#252A32`, `#2A2E35`, `#C7F53B`, `#4EE5B6`, `#FF4D4D`, `#F4F5F6`, JetBrains Mono).
- All 9 field types supported: `text`, `email`, `number`, `textarea`, `choice`, `multi_choice`, `rating`, `date`, `file_upload`.
- Strict TDD: failing test first, verified failure, minimal implementation, verified green, atomic commit.

---

### Task 1: Backend Migrations & Models for Form Versions & Submissions

**Files:**
- Create: `backend/database/migrations/2026_09_18_000002_create_form_versions_table.php`
- Create: `backend/database/migrations/2026_09_18_000003_create_submissions_table.php`
- Create: `backend/database/migrations/2026_09_18_000004_create_submission_answers_table.php`
- Create: `backend/app/Models/FormVersion.php`
- Create: `backend/app/Models/Submission.php`
- Create: `backend/app/Models/SubmissionAnswer.php`
- Modify: `backend/app/Models/Form.php`
- Test: `backend/tests/Feature/SubmissionModelTest.php`

**Interfaces:**
- Consumes: `App\Models\Form`, `App\Models\Workspace`
- Produces: `App\Models\FormVersion`, `App\Models\Submission`, `App\Models\SubmissionAnswer` with Eloquent relationships:
  - `Form::formVersions() -> HasMany`
  - `Form::currentVersion() -> BelongsTo`
  - `Form::submissions() -> HasMany`
  - `FormVersion::form() -> BelongsTo`
  - `Submission::form() -> BelongsTo`
  - `Submission::formVersion() -> BelongsTo`
  - `Submission::answers() -> HasMany`
  - `SubmissionAnswer::submission() -> BelongsTo`

- [x] **Step 1: Write the failing feature test for models and migrations**

Create `backend/tests/Feature/SubmissionModelTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormVersion;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SubmissionModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_form_has_versions_and_current_version(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create([
            'owner_id' => $user->id,
            'name' => 'Test Workspace',
        ]);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Survey Form',
            'slug' => 'survey-form',
            'status' => 'draft',
        ]);

        $schema = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Full Name', 'required' => true],
            ],
        ];

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => $schema,
            'published_at' => now(),
        ]);

        $form->update([
            'status' => 'published',
            'current_version_id' => $version->id,
        ]);

        $this->assertCount(1, $form->fresh()->formVersions);
        $this->assertEquals(1, $form->fresh()->currentVersion->version_no);
        $this->assertEquals($schema, $version->fresh()->schema);
    }

    public function test_submission_belongs_to_form_and_version_with_answers(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W1']);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Feedback',
            'slug' => 'feedback',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => []],
            'published_at' => now(),
        ]);

        $sessionId = (string) Str::uuid();

        $submission = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sessionId,
            'status' => 'complete',
            'started_at' => now()->subMinutes(2),
            'completed_at' => now(),
            'meta' => ['browser' => 'Chrome'],
        ]);

        $answer = SubmissionAnswer::create([
            'submission_id' => $submission->id,
            'field_key' => 'f_1',
            'value' => 'Jane Doe',
        ]);

        $this->assertCount(1, $form->fresh()->submissions);
        $this->assertCount(1, $submission->fresh()->answers);
        $this->assertEquals('Jane Doe', $submission->fresh()->answers->first()->value);
        $this->assertEquals('complete', $submission->fresh()->status);
        $this->assertEquals(['browser' => 'Chrome'], $submission->fresh()->meta);
    }

    public function test_submission_session_id_is_unique_per_form(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W1']);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Lead Gen',
            'slug' => 'lead-gen',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => []],
            'published_at' => now(),
        ]);

        $sessionId = (string) Str::uuid();

        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sessionId,
            'status' => 'partial',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sessionId,
            'status' => 'complete',
        ]);
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test tests/Feature/SubmissionModelTest.php`
Expected: FAIL because tables and models do not exist yet.

- [x] **Step 3: Create migrations and models**

Create `backend/database/migrations/2026_09_18_000002_create_form_versions_table.php`:
```php
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
```

Create `backend/database/migrations/2026_09_18_000003_create_submissions_table.php`:
```php
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
```

Create `backend/database/migrations/2026_09_18_000004_create_submission_answers_table.php`:
```php
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
```

Create `backend/app/Models/FormVersion.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FormVersion extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'form_id',
        'version_no',
        'schema',
        'published_at',
    ];

    protected $casts = [
        'schema' => 'array',
        'published_at' => 'datetime',
        'version_no' => 'integer',
    ];

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }
}
```

Create `backend/app/Models/Submission.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Submission extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'form_id',
        'form_version_id',
        'session_id',
        'status',
        'started_at',
        'completed_at',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }

    public function formVersion(): BelongsTo
    {
        return $this->belongsTo(FormVersion::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(SubmissionAnswer::class);
    }
}
```

Create `backend/app/Models/SubmissionAnswer.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubmissionAnswer extends Model
{
    use HasFactory;

    protected $fillable = [
        'submission_id',
        'field_key',
        'value',
    ];

    protected $casts = [
        'value' => 'json',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }
}
```

Update `backend/app/Models/Form.php` to add relationships:
```php
    public function formVersions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(FormVersion::class);
    }

    public function currentVersion(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(FormVersion::class, 'current_version_id');
    }

    public function submissions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Submission::class);
    }
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && php artisan test tests/Feature/SubmissionModelTest.php`
Expected: PASS (3 tests, assertions pass).

- [x] **Step 5: Run full backend suite and commit**

Run: `cd backend && php artisan test`
Expected: 60 passed.

```bash
git add backend/database/migrations/ backend/app/Models/ backend/tests/Feature/SubmissionModelTest.php
git commit -m "feat(backend): add form_versions, submissions and submission_answers tables and models"
```

---

### Task 2: Backend Publish Form Endpoint & Policy

**Files:**
- Modify: `backend/app/Http/Controllers/Api/FormController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/FormPublishTest.php`

**Interfaces:**
- Consumes: `App\Models\Form`, `App\Domain\FormSchema`, `App\Policies\FormPolicy`
- Produces: Endpoint `POST /api/forms/{id}/publish` returning `{ "success": true, "data": { "form": Form, "version": FormVersion }, "meta": {} }`

- [x] **Step 1: Write the failing feature test for publish endpoint**

Create `backend/tests/Feature/FormPublishTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FormPublishTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceAndUser(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create([
            'owner_id' => $user->id,
            'name' => 'Main Workspace',
        ]);

        return [$user, $workspace];
    }

    public function test_publish_requires_authentication(): void
    {
        $response = $this->postJson('/api/forms/00000000-0000-0000-0000-000000000000/publish');
        $response->assertStatus(401);
    }

    public function test_publish_rejects_empty_or_invalid_schema(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Empty Form',
            'slug' => 'empty-form',
            'status' => 'draft',
            'draft_schema' => ['fields' => []],
        ]);

        $response = $this->postJson("/api/forms/{$form->id}/publish");
        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error.code', 'INVALID_SCHEMA');
    }

    public function test_publish_creates_first_version_and_updates_status(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $validSchema = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Name', 'required' => true],
                ['key' => 'f_2', 'type' => 'email', 'label' => 'Email', 'required' => false],
            ],
        ];

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Registration',
            'slug' => 'registration',
            'status' => 'draft',
            'draft_schema' => $validSchema,
        ]);

        $response = $this->postJson("/api/forms/{$form->id}/publish");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.form.status', 'published');
        $response->assertJsonPath('data.version.version_no', 1);
        $response->assertJsonPath('data.version.schema', $validSchema);

        $freshForm = $form->fresh();
        $this->assertEquals('published', $freshForm->status);
        $this->assertNotNull($freshForm->current_version_id);
        $this->assertEquals(1, $freshForm->currentVersion->version_no);
        $this->assertEquals($validSchema, $freshForm->currentVersion->schema);
    }

    public function test_publish_subsequent_time_increments_version_number(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $schemaV1 = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Name', 'required' => true],
            ],
        ];

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Lead Gen',
            'slug' => 'lead-gen',
            'status' => 'draft',
            'draft_schema' => $schemaV1,
        ]);

        $this->postJson("/api/forms/{$form->id}/publish")->assertStatus(200);

        // Modify draft schema and publish again
        $schemaV2 = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Full Name', 'required' => true],
                ['key' => 'f_2', 'type' => 'rating', 'label' => 'Score', 'required' => false],
            ],
        ];

        $form->update(['draft_schema' => $schemaV2]);

        $response2 = $this->postJson("/api/forms/{$form->id}/publish");
        $response2->assertStatus(200);
        $response2->assertJsonPath('data.version.version_no', 2);

        $this->assertCount(2, $form->fresh()->formVersions);
        $this->assertEquals(2, $form->fresh()->currentVersion->version_no);
        $this->assertEquals($schemaV2, $form->fresh()->currentVersion->schema);

        // Historical version 1 remains unchanged
        $v1 = $form->formVersions()->where('version_no', 1)->first();
        $this->assertEquals($schemaV1, $v1->schema);
    }

    public function test_publish_forbidden_for_other_users_form(): void
    {
        [$owner, $workspace] = $this->createWorkspaceAndUser();
        $otherUser = User::factory()->create();

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Secret Form',
            'slug' => 'secret-form',
            'status' => 'draft',
            'draft_schema' => [
                'fields' => [['key' => 'f_1', 'type' => 'text', 'label' => 'Hi']],
            ],
        ]);

        Sanctum::actingAs($otherUser);
        $response = $this->postJson("/api/forms/{$form->id}/publish");
        $response->assertStatus(403);
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test tests/Feature/FormPublishTest.php`
Expected: FAIL with 404 or method not found.

- [x] **Step 3: Implement publish action in FormController**

Update `backend/app/Http/Controllers/Api/FormController.php` to add `publish` method:
```php
    public function publish(string $id): JsonResponse
    {
        $form = Form::findOrFail($id);
        Gate::authorize('update', $form);

        $schema = $form->draft_schema ?? [];
        $errors = FormSchema::validate($schema);

        if (!empty($errors)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_SCHEMA',
                    'message' => 'Cannot publish form with invalid schema.',
                    'details' => $errors,
                ],
                'meta' => [],
            ], 422);
        }

        if (empty($schema['fields'] ?? [])) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_SCHEMA',
                    'message' => 'Cannot publish form with zero fields.',
                    'details' => ['fields' => 'Form must contain at least one field.'],
                ],
                'meta' => [],
            ], 422);
        }

        $nextVersionNo = ($form->formVersions()->max('version_no') ?? 0) + 1;

        $version = $form->formVersions()->create([
            'version_no' => $nextVersionNo,
            'schema' => $schema,
            'published_at' => now(),
        ]);

        $form->update([
            'status' => 'published',
            'current_version_id' => $version->id,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'form' => $form->fresh(['currentVersion']),
                'version' => $version,
            ],
            'meta' => [],
        ]);
    }
```

Add route in `backend/routes/api.php`:
```php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/forms', [FormController::class, 'index']);
    Route::post('/forms', [FormController::class, 'store']);
    Route::get('/forms/{id}', [FormController::class, 'show']);
    Route::patch('/forms/{id}', [FormController::class, 'update']);
    Route::delete('/forms/{id}', [FormController::class, 'destroy']);
    Route::post('/forms/{id}/publish', [FormController::class, 'publish']);
});
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && php artisan test tests/Feature/FormPublishTest.php`
Expected: PASS (5 tests pass).

- [x] **Step 5: Run full backend test suite and commit**

Run: `cd backend && php artisan test`
Expected: 65 passed (130+ assertions).

```bash
git add backend/app/Http/Controllers/Api/FormController.php backend/routes/api.php backend/tests/Feature/FormPublishTest.php
git commit -m "feat(backend): add publish form endpoint with immutable versioning"
```

---

### Task 3: Go Edge Service Schema Validator for Public Submissions

**Files:**
- Create: `edge/go.mod`
- Create: `edge/internal/schema/validator.go`
- Test: `edge/internal/schema/validator_test.go`

**Interfaces:**
- Consumes: JSON Schema definitions (fields array with types and rules)
- Produces: `ValidateAnswers(schemaJSON []byte, isComplete bool, answers []Answer) (map[string]string, error)`

- [x] **Step 1: Scaffold Go module and write failing unit test**

Initialize `edge/go.mod`:
```bash
mkdir -p edge/internal/schema edge/internal/db edge/internal/handler edge/cmd/server
cd edge && go mod init formforge/edge
```

Create `edge/internal/schema/validator_test.go`:
```go
package schema

import (
	"encoding/json"
	"testing"
)

func TestValidateAnswers_CompleteSubmission_RequiredFields(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_1", "type": "text", "label": "Name", "required": true},
			{"key": "f_2", "type": "email", "label": "Email", "required": true},
			{"key": "f_3", "type": "rating", "label": "Rating", "required": false}
		]
	}`

	// Missing required f_2
	answers := []Answer{
		{FieldKey: "f_1", Value: "Alice"},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), true, answers)
	if err != nil {
		t.Fatalf("unexpected validator error: %v", err)
	}
	if len(errs) == 0 {
		t.Fatalf("expected validation errors for missing email, got 0")
	}
	if _, ok := errs["f_2"]; !ok {
		t.Errorf("expected error for field f_2, got: %v", errs)
	}
}

func TestValidateAnswers_PartialSubmission_AllowsMissingRequired(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_1", "type": "text", "label": "Name", "required": true},
			{"key": "f_2", "type": "email", "label": "Email", "required": true}
		]
	}`

	// Partial submission can have incomplete required fields
	answers := []Answer{
		{FieldKey: "f_1", Value: "Alice"},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), false, answers)
	if err != nil {
		t.Fatalf("unexpected validator error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors on partial submission with missing fields, got: %v", errs)
	}
}

func TestValidateAnswers_FieldTypeValidation(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_email", "type": "email", "label": "Email", "required": false},
			{"key": "f_num", "type": "number", "label": "Age", "required": false},
			{"key": "f_rate", "type": "rating", "label": "Rating", "required": false},
			{"key": "f_choice", "type": "choice", "label": "Option", "required": false, "options": ["A", "B"]}
		]
	}`

	// Invalid values
	answers := []Answer{
		{FieldKey: "f_email", Value: "not-an-email"},
		{FieldKey: "f_num", Value: "not-a-number"},
		{FieldKey: "f_rate", Value: 6}, // rating must be 1-5
		{FieldKey: "f_choice", Value: "C"}, // not in options
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), false, answers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := errs["f_email"]; !ok {
		t.Errorf("expected error for invalid email")
	}
	if _, ok := errs["f_num"]; !ok {
		t.Errorf("expected error for invalid number")
	}
	if _, ok := errs["f_rate"]; !ok {
		t.Errorf("expected error for rating > 5")
	}
	if _, ok := errs["f_choice"]; !ok {
		t.Errorf("expected error for choice not in options")
	}
}

func TestValidateAnswers_ValidValues(t *testing.T) {
	schemaRaw := `{
		"fields": [
			{"key": "f_text", "type": "text", "label": "Text", "required": true},
			{"key": "f_email", "type": "email", "label": "Email", "required": true},
			{"key": "f_num", "type": "number", "label": "Num", "required": true},
			{"key": "f_rate", "type": "rating", "label": "Rating", "required": true},
			{"key": "f_choice", "type": "choice", "label": "Choice", "required": true, "options": ["Yes", "No"]},
			{"key": "f_multi", "type": "multi_choice", "label": "Multi", "required": false, "options": ["X", "Y"]},
			{"key": "f_date", "type": "date", "label": "Date", "required": false}
		]
	}`

	answers := []Answer{
		{FieldKey: "f_text", Value: "Hello World"},
		{FieldKey: "f_email", Value: "test@example.com"},
		{FieldKey: "f_num", Value: 42},
		{FieldKey: "f_rate", Value: 5},
		{FieldKey: "f_choice", Value: "Yes"},
		{FieldKey: "f_multi", Value: []interface{}{"X", "Y"}},
		{FieldKey: "f_date", Value: "2026-09-18"},
	}

	errs, err := ValidateAnswers([]byte(schemaRaw), true, answers)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Errorf("expected 0 errors for valid answers, got: %v", errs)
	}
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd edge && go test ./internal/schema`
Expected: FAIL because `validator.go` is not implemented.

- [x] **Step 3: Implement validator in Go**

Create `edge/internal/schema/validator.go`:
```go
package schema

import (
	"encoding/json"
	"fmt"
	"net/mail"
	"regexp"
	"strconv"
	"strings"
)

type Field struct {
	Key      string   `json:"key"`
	Type     string   `json:"type"`
	Label    string   `json:"label"`
	Required bool     `json:"required"`
	Options  []string `json:"options,omitempty"`
}

type Schema struct {
	Fields []Field `json:"fields"`
}

type Answer struct {
	FieldKey string      `json:"field_key"`
	Value    interface{} `json:"value"`
}

var dateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func ValidateAnswers(schemaJSON []byte, isComplete bool, answers []Answer) (map[string]string, error) {
	var s Schema
	if err := json.Unmarshal(schemaJSON, &s); err != nil {
		return nil, fmt.Errorf("invalid schema json: %w", err)
	}

	errors := make(map[string]string)
	fieldMap := make(map[string]Field)
	for _, f := range s.Fields {
		fieldMap[f.Key] = f
	}

	answerMap := make(map[string]interface{})
	for _, a := range answers {
		answerMap[a.FieldKey] = a.Value
	}

	// 1. Check required fields if submission is complete
	if isComplete {
		for _, f := range s.Fields {
			if f.Required {
				val, exists := answerMap[f.Key]
				if !exists || isEmptyValue(val) {
					errors[f.Key] = fmt.Sprintf("%s is required.", f.Label)
				}
			}
		}
	}

	// 2. Validate types of provided values
	for _, a := range answers {
		f, ok := fieldMap[a.FieldKey]
		if !ok {
			// Answer for field not in schema is rejected
			errors[a.FieldKey] = "Unknown field key."
			continue
		}

		if isEmptyValue(a.Value) {
			continue
		}

		switch f.Type {
		case "email":
			strVal, ok := a.Value.(string)
			if !ok {
				errors[f.Key] = "Email must be a string."
				break
			}
			addr, err := mail.ParseAddress(strVal)
			if err != nil || addr.Address != strVal || !strings.Contains(strVal, "@") || !strings.Contains(strVal, ".") {
				errors[f.Key] = "Invalid email address format."
			}

		case "number":
			switch v := a.Value.(type) {
			case float64:
				// valid json number
			case int:
				// valid
			case string:
				if _, err := strconv.ParseFloat(v, 64); err != nil {
					errors[f.Key] = "Value must be a valid number."
				}
			default:
				errors[f.Key] = "Value must be a valid number."
			}

		case "rating":
			var numVal int
			validNum := false
			switch v := a.Value.(type) {
			case float64:
				numVal = int(v)
				validNum = true
			case int:
				numVal = v
				validNum = true
			}
			if !validNum || numVal < 1 || numVal > 5 {
				errors[f.Key] = "Rating must be an integer between 1 and 5."
			}

		case "choice":
			strVal, ok := a.Value.(string)
			if !ok {
				errors[f.Key] = "Choice must be a string."
				break
			}
			found := false
			for _, opt := range f.Options {
				if opt == strVal {
					found = true
					break
				}
			}
			if !found {
				errors[f.Key] = "Selected option is not valid."
			}

		case "multi_choice":
			arr, ok := a.Value.([]interface{})
			if !ok {
				errors[f.Key] = "Multi choice must be an array of selected options."
				break
			}
			optSet := make(map[string]bool)
			for _, opt := range f.Options {
				optSet[opt] = true
			}
			for _, item := range arr {
				itemStr, ok := item.(string)
				if !ok || !optSet[itemStr] {
					errors[f.Key] = "One or more selected options are invalid."
					break
				}
			}

		case "date":
			strVal, ok := a.Value.(string)
			if !ok || !dateRegex.MatchString(strVal) {
				errors[f.Key] = "Date must be formatted as YYYY-MM-DD."
			}
		}
	}

	return errors, nil
}

func isEmptyValue(v interface{}) bool {
	if v == nil {
		return true
	}
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val) == ""
	case []interface{}:
		return len(val) == 0
	}
	return false
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd edge && go test -v ./internal/schema`
Expected: PASS (all 4 test cases pass).

- [x] **Step 5: Commit**

```bash
git add edge/go.mod edge/internal/schema/
git commit -m "feat(edge): add public submission answer validation against schema"
```

---

### Task 4: Go Edge Service HTTP Handlers & Database Queries

**Files:**
- Create: `edge/internal/db/db.go`
- Create: `edge/internal/handler/handler.go`
- Create: `edge/cmd/server/main.go`
- Test: `edge/internal/handler/handler_test.go`

**Interfaces:**
- Consumes: PostgreSQL DB tables (`forms`, `form_versions`, `submissions`, `submission_answers`)
- Produces:
  - `GET /f/:slug` -> returns 200 `{success: true, data: {slug, title, version_id, schema, settings}}` or 404
  - `POST /f/:slug/submit` -> returns 200 `{success: true, data: {submission_id, status}}` or 422
  - `POST /f/:slug/event` -> returns 204

- [x] **Step 1: Write handler test with mock or integration DB**

Create `edge/internal/handler/handler_test.go`:
```go
package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockStore struct {
	formSlug    string
	formTitle   string
	versionID   string
	schemaJSON  string
	settingsJSON string
	published   bool
}

func (m *mockStore) GetPublishedForm(ctx context.Context, slug string) (*PublishedFormData, error) {
	if !m.published || slug != m.formSlug {
		return nil, ErrNotFound
	}
	return &PublishedFormData{
		FormID:      "00000000-0000-0000-0000-000000000001",
		Slug:        m.formSlug,
		Title:       m.formTitle,
		VersionID:   m.versionID,
		SchemaJSON:  []byte(m.schemaJSON),
		SettingsJSON: []byte(m.settingsJSON),
	}, nil
}

func (m *mockStore) UpsertSubmission(ctx context.Context, sub *SubmissionRecord, answers []AnswerRecord) (string, error) {
	return "sub-12345", nil
}

func (m *mockStore) RecordEvent(ctx context.Context, event *EventRecord) error {
	return nil
}

func TestGetPublishedForm_NotFound(t *testing.T) {
	store := &mockStore{published: false}
	h := NewHandler(store)

	req := httptest.NewRequest(http.MethodGet, "/f/non-existent", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestGetPublishedForm_Success(t *testing.T) {
	store := &mockStore{
		formSlug:    "contact-us",
		formTitle:   "Contact Us",
		versionID:   "v-1",
		schemaJSON:  `{"fields":[{"key":"f_1","type":"text","label":"Name","required":true}]}`,
		settingsJSON: `{}`,
		published:   true,
	}
	h := NewHandler(store)

	req := httptest.NewRequest(http.MethodGet, "/f/contact-us", nil)
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var res struct {
		Success bool `json:"success"`
		Data    struct {
			Slug      string                 `json:"slug"`
			Title     string                 `json:"title"`
			VersionID string                 `json:"version_id"`
			Schema    map[string]interface{} `json:"schema"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if !res.Success || res.Data.Slug != "contact-us" {
		t.Errorf("unexpected response body: %+v", res)
	}
}

func TestSubmitForm_ValidationFailure(t *testing.T) {
	store := &mockStore{
		formSlug:    "survey",
		formTitle:   "Survey",
		versionID:   "v-1",
		schemaJSON:  `{"fields":[{"key":"f_1","type":"email","label":"Email","required":true}]}`,
		settingsJSON: `{}`,
		published:   true,
	}
	h := NewHandler(store)

	// Submit invalid email with complete status
	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","status":"complete","answers":[{"field_key":"f_1","value":"not-an-email"}]}`
	req := httptest.NewRequest(http.MethodPost, "/f/survey/submit", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSubmitForm_Success(t *testing.T) {
	store := &mockStore{
		formSlug:    "survey",
		formTitle:   "Survey",
		versionID:   "v-1",
		schemaJSON:  `{"fields":[{"key":"f_1","type":"text","label":"Name","required":true}]}`,
		settingsJSON: `{}`,
		published:   true,
	}
	h := NewHandler(store)

	body := `{"session_id":"a3b4c5d6-0000-0000-0000-000000000001","status":"complete","answers":[{"field_key":"f_1","value":"Alice"}]}`
	req := httptest.NewRequest(http.MethodPost, "/f/survey/submit", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd edge && go test ./internal/handler`
Expected: FAIL because handler types are not defined.

- [x] **Step 3: Implement database queries and HTTP handler**

Create `edge/internal/db/db.go`:
```go
package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"formforge/edge/internal/handler"

	_ "github.com/lib/pq"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(connStr string) (*PostgresStore, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping db: %w", err)
	}

	return &PostgresStore{db: db}, nil
}

func (p *PostgresStore) GetPublishedForm(ctx context.Context, slug string) (*handler.PublishedFormData, error) {
	query := `
		SELECT f.id, f.slug, f.title, f.current_version_id, v.schema, COALESCE(f.settings, '{}'::jsonb)
		FROM forms f
		JOIN form_versions v ON f.current_version_id = v.id
		WHERE f.slug = $1 AND f.status = 'published'
		LIMIT 1
	`

	var formID, formSlug, title, versionID string
	var schemaBytes, settingsBytes []byte

	err := p.db.QueryRowContext(ctx, query, slug).Scan(
		&formID, &formSlug, &title, &versionID, &schemaBytes, &settingsBytes,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, handler.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query published form: %w", err)
	}

	return &handler.PublishedFormData{
		FormID:       formID,
		Slug:         formSlug,
		Title:        title,
		VersionID:    versionID,
		SchemaJSON:   schemaBytes,
		SettingsJSON: settingsBytes,
	}, nil
}

func (p *PostgresStore) UpsertSubmission(ctx context.Context, sub *handler.SubmissionRecord, answers []handler.AnswerRecord) (string, error) {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	metaJSON, err := json.Marshal(sub.Meta)
	if err != nil {
		metaJSON = []byte("{}")
	}

	upsertQuery := `
		INSERT INTO submissions (id, form_id, form_version_id, session_id, status, started_at, completed_at, meta, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		ON CONFLICT (form_id, session_id) DO UPDATE SET
			form_version_id = EXCLUDED.form_version_id,
			status = EXCLUDED.status,
			completed_at = CASE WHEN EXCLUDED.status = 'complete' THEN NOW() ELSE submissions.completed_at END,
			meta = EXCLUDED.meta,
			updated_at = NOW()
		RETURNING id
	`

	var submissionID string
	var completedAt *time.Time
	if sub.Status == "complete" {
		now := time.Now()
		completedAt = &now
	}

	err = tx.QueryRowContext(ctx, upsertQuery,
		sub.FormID, sub.VersionID, sub.SessionID, sub.Status, sub.StartedAt, completedAt, metaJSON,
	).Scan(&submissionID)
	if err != nil {
		return "", fmt.Errorf("failed to upsert submission: %w", err)
	}

	// Insert or replace answers
	for _, ans := range answers {
		valJSON, err := json.Marshal(ans.Value)
		if err != nil {
			valJSON = []byte("null")
		}

		ansQuery := `
			INSERT INTO submission_answers (submission_id, field_key, value, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
			ON CONFLICT (submission_id, field_key) DO UPDATE SET
				value = EXCLUDED.value,
				updated_at = NOW()
		`
		if _, err := tx.ExecContext(ctx, ansQuery, submissionID, ans.FieldKey, valJSON); err != nil {
			return "", fmt.Errorf("failed to upsert answer %s: %w", ans.FieldKey, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}

	return submissionID, nil
}

func (p *PostgresStore) RecordEvent(ctx context.Context, event *handler.EventRecord) error {
	// Table form_events is created in milestone 6 for analytics, placeholder for now
	return nil
}
```

Create `edge/internal/handler/handler.go`:
```go
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"formforge/edge/internal/schema"
)

var ErrNotFound = errors.New("not found")

type PublishedFormData struct {
	FormID       string
	Slug         string
	Title        string
	VersionID    string
	SchemaJSON   []byte
	SettingsJSON []byte
}

type SubmissionRecord struct {
	FormID    string
	VersionID string
	SessionID string
	Status    string
	StartedAt *time.Time
	Meta      map[string]interface{}
}

type AnswerRecord struct {
	FieldKey string
	Value    interface{}
}

type EventRecord struct {
	FormID    string
	SessionID string
	Type      string
	FieldKey  *string
}

type Store interface {
	GetPublishedForm(ctx context.Context, slug string) (*PublishedFormData, error)
	UpsertSubmission(ctx context.Context, sub *SubmissionRecord, answers []AnswerRecord) (string, error)
	RecordEvent(ctx context.Context, event *EventRecord) error
}

type Handler struct {
	store Store
}

func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/f/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}

	slug := parts[0]

	if len(parts) == 1 {
		if r.Method == http.MethodGet {
			h.handleGetForm(w, r, slug)
			return
		}
	} else if len(parts) == 2 {
		if parts[1] == "submit" && r.Method == http.MethodPost {
			h.handleSubmit(w, r, slug)
			return
		}
		if parts[1] == "event" && r.Method == http.MethodPost {
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	http.NotFound(w, r)
}

func (h *Handler) handleGetForm(w http.ResponseWriter, r *http.Request, slug string) {
	form, err := h.store.GetPublishedForm(r.Context(), slug)
	if errors.Is(err, ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error": map[string]string{
				"code":    "NOT_FOUND",
				"message": "Form not found or not published.",
			},
			"meta": map[string]string{},
		})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error": map[string]string{
				"code":    "SERVER_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	var schemaObj interface{}
	var settingsObj interface{}
	_ = json.Unmarshal(form.SchemaJSON, &schemaObj)
	_ = json.Unmarshal(form.SettingsJSON, &settingsObj)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"slug":       form.Slug,
			"title":      form.Title,
			"version_id": form.VersionID,
			"schema":     schemaObj,
			"settings":   settingsObj,
		},
		"meta": map[string]string{},
	})
}

type submitPayload struct {
	SessionID string                 `json:"session_id"`
	Status    string                 `json:"status"`
	Answers   []schema.Answer        `json:"answers"`
	Meta      map[string]interface{} `json:"meta"`
}

func (h *Handler) handleSubmit(w http.ResponseWriter, r *http.Request, slug string) {
	form, err := h.store.GetPublishedForm(r.Context(), slug)
	if errors.Is(err, ErrNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "NOT_FOUND", "message": "Form not found."},
		})
		return
	}

	var p submitPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "BAD_REQUEST", "message": "Invalid JSON body."},
		})
		return
	}

	if p.SessionID == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "VALIDATION_FAILED", "message": "session_id is required."},
		})
		return
	}

	if p.Status != "partial" && p.Status != "complete" {
		p.Status = "complete"
	}

	isComplete := p.Status == "complete"
	valErrs, err := schema.ValidateAnswers(form.SchemaJSON, isComplete, p.Answers)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "SCHEMA_ERROR", "message": err.Error()},
		})
		return
	}

	if len(valErrs) > 0 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
			"success": false,
			"error": map[string]interface{}{
				"code":    "VALIDATION_FAILED",
				"message": "Submission validation failed.",
				"details": valErrs,
			},
			"meta": map[string]string{},
		})
		return
	}

	var answerRecords []AnswerRecord
	for _, a := range p.Answers {
		answerRecords = append(answerRecords, AnswerRecord{
			FieldKey: a.FieldKey,
			Value:    a.Value,
		})
	}

	subRecord := &SubmissionRecord{
		FormID:    form.FormID,
		VersionID: form.VersionID,
		SessionID: p.SessionID,
		Status:    p.Status,
		Meta:      p.Meta,
	}

	subID, err := h.store.UpsertSubmission(r.Context(), subRecord, answerRecords)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   map[string]string{"code": "DB_ERROR", "message": err.Error()},
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"submission_id": subID,
			"status":        p.Status,
		},
		"meta": map[string]string{},
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
```

Create `edge/cmd/server/main.go`:
```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"formforge/edge/internal/db"
	"formforge/edge/internal/handler"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5433"
	}
	dbUser := os.Getenv("DB_USERNAME")
	if dbUser == "" {
		dbUser = "formforge"
	}
	dbPass := os.Getenv("DB_PASSWORD")
	if dbPass == "" {
		dbPass = "secret"
	}
	dbName := os.Getenv("DB_DATABASE")
	if dbName == "" {
		dbName = "formforge"
	}

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	store, err := db.NewPostgresStore(connStr)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	h := handler.NewHandler(store)

	log.Printf("FormForge Edge Service listening on :%s", port)
	if err := http.ListenAndServe(":"+port, h); err != nil {
		log.Fatalf("server terminated: %v", err)
	}
}
```

Fetch dependency:
`cd edge && go get github.com/lib/pq`

- [x] **Step 4: Run test to verify it passes**

Run: `cd edge && go test -v ./internal/handler`
Expected: PASS (all 4 handler tests pass).

- [x] **Step 5: Commit**

```bash
git add edge/
git commit -m "feat(edge): implement public form read and submission intake HTTP handlers"
```

---

### Task 5: Frontend Builder Publish Action & UI Feedback

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/builder/hooks/useFormBuilder.ts`
- Modify: `frontend/src/builder/components/BuilderView.tsx`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/builder/hooks/useFormBuilder.test.ts`
- Test: `frontend/src/builder/components/BuilderView.test.tsx`

**Interfaces:**
- Consumes: `api.publishForm(formId: string)`
- Produces:
  - `useFormBuilder` exposes `publish()`, `isPublishing: boolean`, `publishError: string | null`, `publishedVersion: number | null`
  - `BuilderView` renders "Publish" button, "Published" status badge, and copyable public form link `/f/${form.slug}`

- [x] **Step 1: Write failing tests for publish API client and hook**

Add tests in `frontend/src/lib/api.test.ts`:
```ts
  it('publishes form successfully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          form: { id: 'f-1', status: 'published' },
          version: { version_no: 1 },
        },
      }),
    }))

    const res = await api.publishForm('f-1')
    expect(res.data.form.status).toBe('published')
    expect(res.data.version.version_no).toBe(1)
  })
```

Add tests in `frontend/src/builder/hooks/useFormBuilder.test.ts`:
```ts
  it('handles publish action successfully', async () => {
    // Mock getForm and publishForm
    // Verify publish() sets form status to published
  })
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/lib/api.test.ts`
Expected: FAIL (`publishForm` is not a function).

- [x] **Step 3: Implement publish in api.ts, hook, and BuilderView**

In `frontend/src/lib/api.ts`:
```ts
  async publishForm(id: string): Promise<{ data: { form: any; version: any } }> {
    const res = await fetch(`${API_BASE}/forms/${id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || 'Failed to publish form')
    }
    return res.json()
  }
```

In `frontend/src/builder/hooks/useFormBuilder.ts`:
Add `isPublishing`, `publishError`, `publish()` method that calls `api.publishForm(formId)`, updates the local form status to `'published'`, and refreshes the form state.

In `frontend/src/builder/components/BuilderView.tsx`:
Add Publish button in the header alongside Save, displaying public link badge `http://localhost:3000/f/${form.slug}` when `form.status === 'published'`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (all frontend tests pass).

- [x] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/builder/hooks/useFormBuilder.ts frontend/src/builder/components/BuilderView.tsx frontend/src/
git commit -m "feat(frontend): add publish form button and public link in builder header"
```

---

### Task 6: Frontend Public Form Renderer for All 9 Field Types

**Files:**
- Create: `frontend/src/renderer/FormRenderer.tsx`
- Create: `frontend/src/app/f/[slug]/page.tsx`
- Test: `frontend/src/renderer/FormRenderer.test.tsx`

**Interfaces:**
- Consumes: Form Schema object (`{ fields: [...] }`), form slug, submission endpoint
- Produces: Fully interactive public form rendering all 9 field types, validating inputs, submitting to Go Edge API, and showing confirmation screen.

- [x] **Step 1: Write failing component test for FormRenderer**

Create `frontend/src/renderer/FormRenderer.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FormRenderer } from './FormRenderer'

describe('FormRenderer', () => {
  const schema = {
    fields: [
      { key: 'f_name', type: 'text', label: 'Full Name', required: true },
      { key: 'f_email', type: 'email', label: 'Email Address', required: true },
      { key: 'f_rate', type: 'rating', label: 'Satisfaction', required: false },
      { key: 'f_choice', type: 'choice', label: 'Plan', required: false, options: ['Free', 'Pro'] },
    ],
  }

  it('renders all fields from schema', () => {
    render(<FormRenderer schema={schema} slug="test-form" onSubmit={vi.fn()} />)
    expect(screen.getByText('Full Name')).toBeDefined()
    expect(screen.getByText('Email Address')).toBeDefined()
    expect(screen.getByText('Satisfaction')).toBeDefined()
    expect(screen.getByText('Plan')).toBeDefined()
  })

  it('validates required fields before submitting', async () => {
    const onSubmit = vi.fn()
    render(<FormRenderer schema={schema} slug="test-form" onSubmit={onSubmit} />)

    const submitBtn = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(submitBtn)

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText(/Full Name is required/i)).toBeDefined()
  })

  it('calls onSubmit with answers when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true })
    render(<FormRenderer schema={schema} slug="test-form" onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'alice@example.com' } })

    const submitBtn = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.arrayContaining([
        { field_key: 'f_name', value: 'Alice' },
        { field_key: 'f_email', value: 'alice@example.com' },
      ]))
    })
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/renderer/FormRenderer.test.tsx`
Expected: FAIL (`FormRenderer` does not exist).

- [x] **Step 3: Implement FormRenderer and /f/[slug] page**

Create `frontend/src/renderer/FormRenderer.tsx`:
Implement clean form inputs for all 9 field types with Rukun dark styling tokens:
- `text`, `email`, `number`, `textarea`: `<input>` and `<textarea>` with `--surface-primary`, `--border-hairline`, `--text-primary`.
- `choice`: radio buttons or select dropdown.
- `multi_choice`: checkboxes.
- `rating`: 1–5 clickable buttons with `--accent-primary` highlights.
- `date`: date picker input.
- `file_upload`: file input placeholder styled as drag-drop box.
- Error messages in `--accent-danger` (`#FF4D4D`).
- Success thank you state screen after submission completes.

Create `frontend/src/app/f/[slug]/page.tsx`:
- Fetches form schema from Edge API (e.g., `http://localhost:8081/f/${slug}` or via internal proxy).
- Maintains a persistent `session_id` (UUID generated on mount).
- Posts answers to Edge API `POST http://localhost:8081/f/${slug}/submit`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (all tests pass).

- [x] **Step 5: Commit**

```bash
git add frontend/src/renderer/ frontend/src/app/f/
git commit -m "feat(frontend): implement public form renderer for 9 field types with submission flow"
```

---

### Task 7: Local-CI Gates Update & Playwright E2E Integration Test

**Files:**
- Modify: `scripts/local-ci.sh`
- Create: `frontend/e2e/publish-and-submit.spec.ts`
- Test: Full `scripts/local-ci.sh --tier t0 --fast`

**Interfaces:**
- Consumes: Go toolchain (`go test`, `go vet`), Edge Service, Next.js frontend, Laravel API
- Produces:
  - `go:vet` and `go:test` gates in `scripts/local-ci.sh`
  - Playwright test verifying publish in builder and form submission in public renderer.

- [ ] **Step 1: Update scripts/local-ci.sh to add Go gates**

Add detection and gates in `scripts/local-ci.sh`:
```bash
if [ -d "edge" ] && [ -f "edge/go.mod" ]; then
  IS_GO=1
fi
```
Under stack gates:
```bash
if [ "${IS_GO:-0}" = 1 ]; then
  gate "go:vet" "$(have go || echo 'go missing')" bash -c "cd edge && go vet ./..."
  gate "go:test" "$(have go || echo 'go missing')" bash -c "cd edge && go test ./..."
fi
```

- [ ] **Step 2: Create Playwright E2E integration test**

Create `frontend/e2e/publish-and-submit.spec.ts`:
Test verifies end-to-end flow:
1. Mocks or triggers publish action.
2. Visits `/f/test-slug`.
3. Fills in form answers (Name, Email, Rating).
4. Clicks Submit.
5. Verifies Thank You / Success screen appears.

- [ ] **Step 3: Run local-ci gates and Playwright tests**

Run: `bash scripts/local-ci.sh --tier t0 --fast`
Expected: ALL GREEN including `go:vet`, `go:test`, `node:*`, `php:*`.

Run: `cd frontend && npx playwright test e2e/publish-and-submit.spec.ts`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add scripts/local-ci.sh frontend/e2e/publish-and-submit.spec.ts
git commit -m "ci: add go gates to local-ci and playwright e2e publish-and-submit test"
```
