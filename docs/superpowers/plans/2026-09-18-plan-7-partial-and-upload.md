# Plan 7: Partial Autosave & File Upload (Milestone 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete Partial Submission & File Upload subsystem:
1. Backend `uploads` table migration & `POST /api/uploads` multipart upload handler (mime/size validation, local storage).
2. Go Edge service canonical `file` type validation and support for file references in submission answers.
3. Frontend `FormRenderer` file field integration (file selection, asynchronous upload to `/api/uploads`, upload progress/done state, clear file).
4. Frontend Public Form Page autosave engine: debounced (3s) `POST /f/:slug/submit` with `status: "partial"`, subtle "Tersimpan otomatis" indicator, seamless finalization on `status: "complete"`.
5. Playwright E2E & Local-CI gate for Milestone 7.

**Architecture:**
- **File Upload (`POST /api/uploads`):**
  - Public or authenticated multipart upload accepting `file` and optional `form_id`.
  - Allowed mimes: `jpeg, png, gif, webp, svg, pdf, doc, docx, xls, xlsx, csv, txt, zip`.
  - Max size: 10MB (10240 KB).
  - Persisted to storage disk (`storage/app/public/uploads/...`) and logged in `uploads` table (`id`, `form_id`, `filename`, `mime`, `size`, `storage_path`).
  - Returns `{ success: true, data: { id, filename, mime, size, url } }`.
- **Edge Validation (Go):**
  - Accepts both `"file"` and `"file_upload"` field types in `validator.go`.
  - Validates file answer value as string (URL/name/ID) or map (metadata object).
- **Client Autosave (Next.js):**
  - In `frontend/src/app/f/[slug]/page.tsx`:
  - Maintains debounced effect (3 seconds) listening to `answers` changes.
  - When answers change and at least one value is non-empty, triggers `POST ${EDGE_URL}/f/${slug}/submit` with `status: "partial"` and current answers.
  - Renders a subtle status indicator ("Menyimpan..." / "Tersimpan otomatis") in the public form container.
  - Submit button triggers `status: "complete"`, finalizing the submission and recording the `complete` telemetry event.

**Tech Stack:** Laravel 12, PHPUnit 12, Go 1.27, Next.js 16 (React 19, TypeScript 5.9.3, Tailwind CSS v4), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md` §3.1, §4 (`uploads`), §5.1, §8 (Milestone 7)

---

### Task 1: Backend Database Migration for `uploads` & `POST /api/uploads` Endpoint

**Files:**
- Create: `backend/database/migrations/2026_09_18_000007_create_uploads_table.php`
- Create: `backend/app/Models/Upload.php`
- Create: `backend/app/Http/Controllers/Api/UploadController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/UploadApiTest.php`

**Interfaces:**
- Produces: `uploads` table in Postgres:
  - `id`: uuid primary key
  - `form_id`: foreignUuid('forms')->nullable()->constrained('forms')->nullOnDelete()
  - `submission_id`: foreignUuid('submissions')->nullable()->constrained('submissions')->nullOnDelete()
  - `filename`: string
  - `mime`: string(128)
  - `size`: unsignedBigInteger
  - `storage_path`: string
  - `timestamps`
- Endpoint: `POST /api/uploads` (multipart/form-data):
  - Validates `file` is present, valid file, max 10240 KB, allowed mimes.
  - Stores file in `storage/app/public/uploads`.
  - Creates row in `uploads`.
  - Returns `201 Created` with JSON:
    `{ "success": true, "data": { "id": "uuid", "filename": "doc.pdf", "mime": "application/pdf", "size": 12345, "url": "/storage/uploads/..." } }`.

- [ ] **Step 1: Write failing feature test for file upload endpoint and model**

In `backend/tests/Feature/UploadApiTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UploadApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_uploads_valid_file_successfully(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 500, 'application/pdf');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'filename' => 'document.pdf',
                    'mime' => 'application/pdf',
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data['id']);
        $this->assertNotEmpty($data['url']);
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $data['url']));

        $this->assertDatabaseHas('uploads', [
            'id' => $data['id'],
            'filename' => 'document.pdf',
        ]);
    }

    public function test_rejects_disallowed_file_extension(): void
    {
        $file = UploadedFile::fake()->create('exploit.exe', 100, 'application/x-msdownload');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_rejects_file_exceeding_max_size(): void
    {
        // 12MB > 10MB limit
        $file = UploadedFile::fake()->create('large.pdf', 12288, 'application/pdf');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }
}
```

- [ ] **Step 2: Run test to confirm failure**

Run: `cd backend && php artisan test tests/Feature/UploadApiTest.php`
Expected: FAIL.

- [ ] **Step 3: Implement migration, Upload model, and UploadController**

1. Migration `2026_09_18_000007_create_uploads_table.php`
2. Model `Upload.php` (`protected $keyType = 'string'; public $incrementing = false;`)
3. `UploadController.php` with validation rules:
   `'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,svg,pdf,doc,docx,xls,xlsx,csv,txt,zip']`
4. Register route in `backend/routes/api.php`:
   `Route::post('/uploads', [UploadController::class, 'store']);`

- [ ] **Step 4: Run backend tests to verify pass**

Run: `cd backend && php artisan test`
Expected: 92+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/ backend/app/Models/ backend/app/Http/Controllers/Api/UploadController.php backend/routes/api.php backend/tests/Feature/UploadApiTest.php
git commit -m "feat(backend): add uploads table migration and POST /api/uploads endpoint"
```

---

### Task 2: Go Edge Service Canonical `file` Type Validation

**Files:**
- Modify: `edge/internal/schema/validator.go`
- Test: `edge/internal/schema/validator_test.go`

**Interfaces:**
- Consumes: Submission answer for field with type `"file"` or `"file_upload"`.
- Produces: Accepts strings (filename, URL, UUID) or metadata maps (`{"url": "...", "filename": "..."}`), rejects non-scalar/invalid shapes.

- [ ] **Step 1: Write failing unit test for canonical file type validation**

In `edge/internal/schema/validator_test.go`:
- Test validation succeeds when field type is `"file"` with valid string answer.
- Test validation succeeds when field type is `"file"` with metadata map.
- Test validation fails when field type is `"file"` with invalid number or boolean value.

- [ ] **Step 2: Run Go tests to confirm failure**

Run: `cd edge && go test ./internal/schema`
Expected: FAIL.

- [ ] **Step 3: Update validator in `edge/internal/schema/validator.go`**

In `validator.go`:
- Match both `case "file", "file_upload":`.
- Accept string or `map[string]interface{}`.

- [ ] **Step 4: Run Go tests to verify pass**

Run: `cd edge && go test -v ./... && go vet ./...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add edge/internal/schema/
git commit -m "feat(edge): accept canonical 'file' type in submission validation"
```

---

### Task 3: Frontend File Upload Integration in FormRenderer

**Files:**
- Modify: `frontend/src/renderer/FormRenderer.tsx`
- Test: `frontend/src/renderer/FormRenderer.test.tsx`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- `api.uploadFile(file: File, token?: string)`: calls `POST /api/uploads`.
- `FormRenderer`:
  - When user chooses a file for `file` field, triggers upload.
  - Shows uploading spinner / status text.
  - On upload success, stores uploaded file URL / metadata in field value.
  - Allows removing / clearing the uploaded file.

- [ ] **Step 1: Write failing unit tests for uploadFile and FormRenderer file upload**

In `frontend/src/lib/api.test.ts`:
- Test `uploadFile` sends FormData to `/api/uploads`.

In `frontend/src/renderer/FormRenderer.test.tsx`:
- Test choosing a file triggers upload and sets value.
- Test displays uploaded filename and clear button.
- Test handles upload failure cleanly with error message.

- [ ] **Step 2: Run tests to confirm failure**

Run: `cd frontend && npm test src/lib/api.test.ts src/renderer/FormRenderer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement uploadFile and file field upload in FormRenderer**

- In `frontend/src/lib/api.ts`: implement `uploadFile(file: File): Promise<{ id: string; filename: string; url: string }>`.
- In `frontend/src/renderer/FormRenderer.tsx`:
  - Add file upload handler calling `uploadFile` (or fallback mock if api unavailable).
  - Show upload progress/spinner.
  - Provide "Hapus" (remove) button when file is uploaded.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test`
Expected: All Vitest tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/renderer/
git commit -m "feat(frontend): add asynchronous file upload integration in FormRenderer"
```

---

### Task 4: Frontend Autosave Partial Submission Engine & Status Indicator

**Files:**
- Modify: `frontend/src/renderer/FormRenderer.tsx`
- Modify: `frontend/src/app/f/[slug]/page.tsx`
- Test: `frontend/src/renderer/FormRenderer.test.tsx`
- Test: `frontend/src/app/f/[slug]/page.test.tsx`

**Interfaces:**
- `FormRenderer`:
  - Provides `onChange?: (answers: AnswerItem[]) => void` callback or `onPartialSubmit?: (answers: AnswerItem[]) => void`.
- `app/f/[slug]/page.tsx`:
  - Debounce 3 seconds: when form inputs change and have non-empty answers, sends `POST ${EDGE_URL}/f/${slug}/submit` with `{ session_id, status: 'partial', answers }`.
  - Displays "Tersimpan otomatis" (autosaved) or "Menyimpan..." indicator.
  - On submit button: sends `status: 'complete'`.

- [ ] **Step 1: Write failing tests for debounced partial autosave**

In `frontend/src/app/f/[slug]/page.test.tsx`:
- Test typing in a field triggers debounced partial submission after 3s.
- Test autosave status changes to "Tersimpan otomatis".
- Test final submit sends `status: 'complete'`.

- [ ] **Step 2: Run test to confirm failure**

Run: `cd frontend && npm test src/app/f/[slug]/page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement debounced autosave in public form page**

- Add `onChange?: (answers: AnswerItem[]) => void` to `FormRenderer`.
- In `app/f/[slug]/page.tsx`:
  - Use `useEffect` with 3000ms timer debouncing `POST ${edgeUrl}/f/${slug}/submit` with `status: 'partial'`.
  - Update `autosaveStatus` state: `'idle' | 'saving' | 'saved'`.
  - Render status indicator badge in the public header/footer:
    - saving: `<span className="text-xs text-[var(--color-accent-warning)]">Menyimpan draf...</span>`
    - saved: `<span className="text-xs text-[var(--color-accent-success)]">Tersimpan otomatis</span>`

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 5: Run lint and typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/renderer/ frontend/src/app/f/
git commit -m "feat(frontend): implement debounced partial submission autosave engine with status badge"
```

---

### Task 5: Gerbang Milestone 7 — Local-CI & Playwright E2E Partial Autosave & File Upload Test

**Files:**
- Create: `frontend/e2e/partial-and-upload.spec.ts`
- Test: `scripts/local-ci.sh --tier t0 --fast`

**Interfaces:**
- Produces: Playwright E2E test testing:
  - Partial autosave: filling field triggers partial submit without errors.
  - File upload: selecting file uploads and displays uploaded filename.
  - Final submission: clicking submit completes submission successfully.
- All 11 local-ci gates pass cleanly.

- [ ] **Step 1: Write Playwright E2E test**

Create `frontend/e2e/partial-and-upload.spec.ts`:
- Mock GET `/f/upload-survey`
- Mock POST `/f/upload-survey/submit` (handling both partial and complete)
- Mock POST `/api/uploads`
- Navigate to `/f/upload-survey`
- Fill in text field -> wait for autosave indicator
- Select file -> verify upload success
- Click submit -> verify thank you confirmation

- [ ] **Step 2: Run Playwright test**

Run: `cd frontend && npx playwright test e2e/partial-and-upload.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run full local-ci gate**

Run: `bash scripts/local-ci.sh --tier t0 --fast`
Expected: ALL GREEN (11/11 gates pass).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/partial-and-upload.spec.ts
git commit -m "ci: add playwright partial autosave and upload e2e test and verify all local-ci gates for milestone 7"
```
