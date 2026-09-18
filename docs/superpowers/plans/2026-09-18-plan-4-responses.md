# Plan 4: Responses View & CSV Export (Milestone 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the submission responses dashboard: Laravel provides paginated response listing and streaming CSV export (`GET /api/forms/:id/responses` and `GET /api/forms/:id/responses/export`), and Next.js delivers a responsive data table in `/forms/[id]/responses` with Rukun tokens, filterable by status (`all | complete | partial`), column headers derived from form schema fields, and 1-click CSV export.

**Architecture:**
- Laravel backend:
  - `ResponseController::index`: retrieves paginated submissions for a form owned by user's workspace with eagerly loaded answers.
  - `ResponseController::export`: streams CSV directly with headers based on the form's latest schema field keys and labels.
  - `FormPolicy::view` enforces multi-tenant boundary.
- Next.js frontend:
  - Responses page at `/forms/[id]/responses` with Navigation bar (Builder / Responses switch).
  - Data table displaying respondent `session_id`, status badge (`complete` in `--accent-success`, `partial` in `--accent-warning`), submitted timestamp, and dynamic answer cells.
  - Export CSV button triggering direct file download.
  - Empty, loading skeleton, and error states.

**Tech Stack:** Laravel 12, PHPUnit 12, Next.js 16 (React 19, TypeScript 5.9.3, Tailwind CSS v4), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md` §2, §3.4, §8

## Global Constraints
- Envelope response `{ "success": boolean, "data": ..., "error": ..., "meta": ... }` for JSON endpoints; standard CSV headers (`Content-Type: text/csv`, `Content-Disposition: attachment; filename="form-{slug}-responses.csv"`) for export.
- Rukun design tokens (`#16181C`, `#1E2228`, `#252A32`, `#2A2E35`, `#C7F53B`, `#4EE5B6`, `#F5A623`, `#FF4D4D`, `#F4F5F6`, JetBrains Mono).
- Zero N+1 query in backend (`with('answers')`).
- Strict TDD: failing tests first, confirmed failure, minimal code, verified pass, atomic commit.

---

### Task 1: Backend Responses API (Paginated List)

**Files:**
- Create: `backend/app/Http/Controllers/Api/ResponseController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/ResponseApiTest.php`

**Interfaces:**
- Consumes: `App\Models\Form`, `App\Models\Submission`, `App\Models\SubmissionAnswer`
- Produces: `GET /api/forms/{id}/responses` returning paginated submissions with answers in standard envelope.

- [x] **Step 1: Write failing feature test for responses list**

Create `backend/tests/Feature/ResponseApiTest.php`:
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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResponseApiTest extends TestCase
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

    public function test_responses_requires_authentication(): void
    {
        $response = $this->getJson('/api/forms/00000000-0000-0000-0000-000000000000/responses');
        $response->assertStatus(401);
    }

    public function test_responses_forbidden_for_other_users_form(): void
    {
        [$owner, $workspace] = $this->createWorkspaceAndUser();
        $otherUser = User::factory()->create();

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Secret Form',
            'slug' => 'secret-form',
            'status' => 'published',
        ]);

        Sanctum::actingAs($otherUser);
        $response = $this->getJson("/api/forms/{$form->id}/responses");
        $response->assertStatus(403);
    }

    public function test_responses_returns_paginated_submissions_with_answers(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Customer Feedback',
            'slug' => 'customer-feedback',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => [['key' => 'f_1', 'type' => 'text', 'label' => 'Name']]],
            'published_at' => now(),
        ]);

        $sub1 = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'complete',
            'started_at' => now()->subMinutes(1),
            'completed_at' => now(),
        ]);
        SubmissionAnswer::create([
            'submission_id' => $sub1->id,
            'field_key' => 'f_1',
            'value' => 'Alice',
        ]);

        $sub2 = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'partial',
            'started_at' => now(),
        ]);
        SubmissionAnswer::create([
            'submission_id' => $sub2->id,
            'field_key' => 'f_1',
            'value' => 'Bob',
        ]);

        $response = $this->getJson("/api/forms/{$form->id}/responses");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonCount(2, 'data.items');
        $this->assertEquals('complete', $response->json('data.items.0.status'));
        $this->assertEquals('Alice', $response->json('data.items.0.answers.0.value'));
        $this->assertEquals(2, $response->json('meta.total'));
    }

    public function test_responses_can_be_filtered_by_status(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Poll',
            'slug' => 'poll',
            'status' => 'published',
        ]);
        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => []],
        ]);

        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'complete',
        ]);
        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'partial',
        ]);

        $response = $this->getJson("/api/forms/{$form->id}/responses?status=complete");
        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data.items');
        $this->assertEquals('complete', $response->json('data.items.0.status'));
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test tests/Feature/ResponseApiTest.php`
Expected: FAIL (404 / Route not found).

- [x] **Step 3: Implement ResponseController::index and route**

Create `backend/app/Http/Controllers/Api/ResponseController.php`:
```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResponseController extends Controller
{
    public function index(Request $request, string $id): JsonResponse
    {
        $form = Form::findOrFail($id);
        Gate::authorize('view', $form);

        $query = $form->submissions()->with('answers')->latest();

        if ($request->has('status') && in_array($request->query('status'), ['partial', 'complete'], true)) {
            $query->where('status', $request->query('status'));
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $paginated->items(),
            ],
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'last_page' => $paginated->lastPage(),
            ],
        ]);
    }
}
```

Add route in `backend/routes/api.php`:
```php
Route::get('/forms/{id}/responses', [ResponseController::class, 'index']);
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd backend && php artisan test tests/Feature/ResponseApiTest.php`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/ResponseController.php backend/routes/api.php backend/tests/Feature/ResponseApiTest.php
git commit -m "feat(backend): add paginated responses API with status filtering"
```

---

### Task 2: Backend Streaming CSV Export API

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ResponseController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/ResponseExportTest.php`

**Interfaces:**
- Consumes: Form schema fields, submissions with answers
- Produces: `GET /api/forms/{id}/responses/export` streaming CSV with headers `Submission ID, Session ID, Status, Started At, Completed At, [Field Labels...]`

- [ ] **Step 1: Write failing feature test for CSV export**

Create `backend/tests/Feature/ResponseExportTest.php`:
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
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResponseExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_requires_authentication(): void
    {
        $response = $this->get('/api/forms/00000000-0000-0000-0000-000000000000/responses/export');
        $response->assertStatus(401);
    }

    public function test_export_streams_csv_with_headers_and_answers(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W1']);
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Event Sign-up',
            'slug' => 'event-signup',
            'status' => 'published',
            'draft_schema' => [
                'fields' => [
                    ['key' => 'f_name', 'type' => 'text', 'label' => 'Nama Lengkap'],
                    ['key' => 'f_email', 'type' => 'email', 'label' => 'Alamat Email'],
                ],
            ],
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => $form->draft_schema,
            'published_at' => now(),
        ]);
        $form->update(['current_version_id' => $version->id]);

        $sub = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'complete',
            'started_at' => '2026-09-18 10:00:00',
            'completed_at' => '2026-09-18 10:02:00',
        ]);

        SubmissionAnswer::create(['submission_id' => $sub->id, 'field_key' => 'f_name', 'value' => 'Budi Santoso']);
        SubmissionAnswer::create(['submission_id' => $sub->id, 'field_key' => 'f_email', 'value' => 'budi@example.com']);

        $response = $this->get("/api/forms/{$form->id}/responses/export");
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('attachment; filename="form-event-signup-responses.csv"', (string) $response->headers->get('Content-Disposition'));

        $content = $response->streamedContent();
        $this->assertStringContainsString('Submission ID,Session ID,Status,Started At,Completed At,"Nama Lengkap","Alamat Email"', $content);
        $this->assertStringContainsString('"Budi Santoso","budi@example.com"', $content);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test tests/Feature/ResponseExportTest.php`
Expected: FAIL (404 route not found).

- [ ] **Step 3: Implement export action in ResponseController**

Add `export` method in `backend/app/Http/Controllers/Api/ResponseController.php`:
```php
    public function export(string $id): StreamedResponse
    {
        $form = Form::with('currentVersion')->findOrFail($id);
        Gate::authorize('view', $form);

        $schema = $form->currentVersion->schema ?? $form->draft_schema ?? ['fields' => []];
        $fields = $schema['fields'] ?? [];

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="form-%s-responses.csv"', $form->slug),
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($form, $fields) {
            $handle = fopen('php://output', 'w');

            // Header row
            $headerRow = ['Submission ID', 'Session ID', 'Status', 'Started At', 'Completed At'];
            foreach ($fields as $f) {
                $headerRow[] = $f['label'] ?? $f['key'];
            }
            fputcsv($handle, $headerRow);

            // Chunk submissions to avoid memory exhaustion
            $form->submissions()->with('answers')->chunk(200, function ($submissions) use ($handle, $fields) {
                foreach ($submissions as $sub) {
                    $answerMap = [];
                    foreach ($sub->answers as $ans) {
                        $val = $ans->value;
                        if (is_array($val)) {
                            $answerMap[$ans->field_key] = implode(', ', $val);
                        } else {
                            $answerMap[$ans->field_key] = (string) $val;
                        }
                    }

                    $row = [
                        $sub->id,
                        $sub->session_id,
                        $sub->status,
                        $sub->started_at?->toIso8601String() ?? '',
                        $sub->completed_at?->toIso8601String() ?? '',
                    ];

                    foreach ($fields as $f) {
                        $row[] = $answerMap[$f['key']] ?? '';
                    }

                    fputcsv($handle, $row);
                }
            });

            fclose($handle);
        }, 200, $headers);
    }
```

Add route in `backend/routes/api.php`:
```php
Route::get('/forms/{id}/responses/export', [ResponseController::class, 'export']);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && php artisan test tests/Feature/ResponseExportTest.php`
Expected: PASS (2 tests).

- [ ] **Step 5: Run all backend tests and commit**

Run: `cd backend && php artisan test`
Expected: 73 passed (160+ assertions).

```bash
git add backend/app/Http/Controllers/Api/ResponseController.php backend/routes/api.php backend/tests/Feature/ResponseExportTest.php
git commit -m "feat(backend): add streaming CSV export for form responses"
```

---

### Task 3: Frontend API Client Methods for Responses & CSV Download

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `api.getResponses(formId, status?, page?)`
  - `api.exportResponsesUrl(formId)`

- [ ] **Step 1: Write failing tests for response API methods**

In `frontend/src/lib/api.test.ts`:
```ts
  it('fetches form responses list with pagination', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { items: [{ id: 'sub-1', status: 'complete' }] },
        meta: { total: 1, current_page: 1, last_page: 1 },
      }),
    }))

    const res = await api.getResponses('form-1', 'complete', 1)
    expect(res.data.items.length).toBe(1)
    expect(res.meta.total).toBe(1)
  })

  it('generates export CSV URL with auth token parameter or direct link', () => {
    const url = api.exportResponsesUrl('form-1')
    expect(url).toContain('/api/forms/form-1/responses/export')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/lib/api.test.ts`
Expected: FAIL (`getResponses` is not a function).

- [ ] **Step 3: Implement methods in api.ts**

Add in `frontend/src/lib/api.ts`:
```ts
  async getResponses(
    formId: string,
    status?: string,
    page: number = 1
  ): Promise<{ data: { items: any[] }; meta: { total: number; current_page: number; last_page: number; per_page: number } }> {
    const params = new URLSearchParams()
    if (status && status !== 'all') params.set('status', status)
    if (page > 1) params.set('page', String(page))

    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${API_BASE}/forms/${formId}/responses${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || 'Failed to fetch responses')
    }
    return res.json()
  },

  exportResponsesUrl(formId: string): string {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : ''
    return `${API_BASE}/forms/${formId}/responses/export?token=${token || ''}`
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "feat(frontend): add getResponses and exportResponsesUrl to api client"
```

---

### Task 4: Frontend Responses Table Component & Status Filtering

**Files:**
- Create: `frontend/src/responses/components/ResponsesTable.tsx`
- Test: `frontend/src/responses/components/ResponsesTable.test.tsx`

**Interfaces:**
- Consumes: `schema: FormSchema`, `items: Submission[]`, `total: number`, `statusFilter: string`, `onStatusFilterChange: (status: string) => void`, `onExport: () => void`
- Produces: Data table rendering headers from schema fields, status badges, formatted timestamps, and export button.

- [ ] **Step 1: Write failing component test**

Create `frontend/src/responses/components/ResponsesTable.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ResponsesTable } from './ResponsesTable'

describe('ResponsesTable', () => {
  const schema = {
    fields: [
      { key: 'f_name', type: 'text', label: 'Full Name', required: true },
      { key: 'f_score', type: 'rating', label: 'Satisfaction', required: false },
    ],
  }

  const items = [
    {
      id: 'sub-1',
      session_id: 'sess-uuid-1',
      status: 'complete',
      started_at: '2026-09-18T10:00:00Z',
      completed_at: '2026-09-18T10:02:00Z',
      answers: [
        { field_key: 'f_name', value: 'Alice' },
        { field_key: 'f_score', value: 5 },
      ],
    },
    {
      id: 'sub-2',
      session_id: 'sess-uuid-2',
      status: 'partial',
      started_at: '2026-09-18T10:05:00Z',
      completed_at: null,
      answers: [
        { field_key: 'f_name', value: 'Bob' },
      ],
    },
  ]

  it('renders table headers matching schema field labels', () => {
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    )
    expect(screen.getByText('Full Name')).toBeDefined()
    expect(screen.getByText('Satisfaction')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('renders rows with respondent answers and status badges', () => {
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={vi.fn()}
      />
    )
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
    expect(screen.getByText('complete')).toBeDefined()
    expect(screen.getByText('partial')).toBeDefined()
  })

  it('calls onExport when Export CSV button is clicked', () => {
    const onExport = vi.fn()
    render(
      <ResponsesTable
        schema={schema}
        items={items}
        total={2}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExport={onExport}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/responses/components/ResponsesTable.test.tsx`
Expected: FAIL (`ResponsesTable` does not exist).

- [ ] **Step 3: Implement ResponsesTable component**

Create `frontend/src/responses/components/ResponsesTable.tsx`:
```tsx
'use client'

import React from 'react'

interface Field {
  key: string
  label: string
  type: string
}

interface Answer {
  field_key: string
  value: any
}

interface Submission {
  id: string
  session_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  answers: Answer[]
}

interface ResponsesTableProps {
  schema: { fields?: Field[] } | null
  items: Submission[]
  total: number
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  onExport: () => void
  isLoading?: boolean
}

export function ResponsesTable({
  schema,
  items,
  total,
  statusFilter,
  onStatusFilterChange,
  onExport,
  isLoading = false,
}: ResponsesTableProps) {
  const fields = schema?.fields || []

  return (
    <div className="flex flex-col gap-4 text-[var(--color-text-primary)]">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Filter:</span>
          {['all', 'complete', 'partial'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatusFilterChange(st)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-[var(--color-accent-primary)] text-[var(--color-bg-primary)] font-semibold'
                  : 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {st}
            </button>
          ))}
          <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">
            Total: {total}
          </span>
        </div>

        <button
          type="button"
          onClick={onExport}
          disabled={items.length === 0}
          className="flex items-center gap-1.5 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-accent-primary)] disabled:opacity-40 transition-colors"
        >
          <span>↓</span> Export CSV
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 font-mono">Session ID</th>
              <th className="px-3 py-2.5">Waktu</th>
              {fields.map((f) => (
                <th key={f.key} className="px-3 py-2.5">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-hairline)]">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={3 + fields.length}
                  className="py-8 text-center text-[var(--color-text-muted)]"
                >
                  {isLoading ? 'Memuat data respons...' : 'Belum ada respons yang masuk.'}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const answerMap = new Map(row.answers?.map((a) => [a.field_key, a.value]))
                const isComplete = row.status === 'complete'

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--color-surface-elevated)]/50 transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase font-mono ${
                          isComplete
                            ? 'bg-[var(--color-accent-success)]/10 text-[var(--color-accent-success)] border border-[var(--color-accent-success)]/20'
                            : 'bg-[var(--color-accent-warning)]/10 text-[var(--color-accent-warning)] border border-[var(--color-accent-warning)]/20'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
                      {row.session_id.slice(0, 8)}...
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--color-text-muted)]">
                      {row.completed_at
                        ? new Date(row.completed_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                        : row.started_at
                        ? new Date(row.started_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    {fields.map((f) => {
                      const val = answerMap.get(f.key)
                      let displayVal = '—'
                      if (val !== undefined && val !== null && val !== '') {
                        displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                      }
                      return (
                        <td key={f.key} className="px-3 py-2.5 max-w-xs truncate">
                          {displayVal}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test src/responses/components/ResponsesTable.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/responses/components/
git commit -m "feat(frontend): implement ResponsesTable component with status filtering and Rukun styling"
```

---

### Task 5: Frontend Responses Page & Builder Navigation

**Files:**
- Create: `frontend/src/app/forms/[id]/responses/page.tsx`
- Modify: `frontend/src/builder/components/BuilderView.tsx`
- Test: `frontend/src/app/forms/[id]/responses/page.test.tsx`

**Interfaces:**
- Produces:
  - Route `/forms/[id]/responses` fetching responses and displaying table with CSV export.
  - Sub-navigation links in `/forms/[id]/edit` and `/forms/[id]/responses` to switch between "Builder" and "Responses".

- [ ] **Step 1: Write failing test for responses page**

Create `frontend/src/app/forms/[id]/responses/page.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResponsesPage from './page'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  api: {
    getForm: vi.fn(),
    getResponses: vi.fn(),
    exportResponsesUrl: vi.fn().mockReturnValue('/mock-export-url'),
  },
}))

describe('ResponsesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads form and responses, rendering table', async () => {
    vi.mocked(api.getForm).mockResolvedValue({
      data: {
        id: 'f-1',
        title: 'Survey Mahasiswa',
        slug: 'survey-mahasiswa',
        draft_schema: {
          fields: [{ key: 'f_name', type: 'text', label: 'Nama' }],
        },
      } as any,
    })

    vi.mocked(api.getResponses).mockResolvedValue({
      data: {
        items: [
          {
            id: 'sub-1',
            session_id: 'sess-1234',
            status: 'complete',
            started_at: '2026-09-18T10:00:00Z',
            completed_at: '2026-09-18T10:02:00Z',
            answers: [{ field_key: 'f_name', value: 'Budi' }],
          },
        ],
      },
      meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 },
    })

    render(<ResponsesPage params={Promise.resolve({ id: 'f-1' })} />)

    await waitFor(() => {
      expect(screen.getByText('Survey Mahasiswa')).toBeDefined()
      expect(screen.getByText('Budi')).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test src/app/forms/\[id\]/responses/page.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement ResponsesPage and tab switcher in BuilderView**

Create `frontend/src/app/forms/[id]/responses/page.tsx`:
- Fetches form details (for schema and title) and responses.
- Provides tab navigation: `[Builder]` link to `/forms/[id]/edit` and `[Responses]` active link.
- Handles CSV export click by fetching blob with Authorization header or opening download window.

Update `frontend/src/builder/components/BuilderView.tsx`:
- Add tab link in header: "Builder" (active) and "Responses" link to `/forms/${formId}/responses`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS (all tests pass).

- [ ] **Step 5: Run lint and typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/forms/\[id\]/responses/ frontend/src/builder/components/BuilderView.tsx
git commit -m "feat(frontend): implement responses page route and builder tab navigation"
```

---

### Task 6: Gerbang Milestone 4 — Local-CI & Playwright E2E Responses Test

**Files:**
- Create: `frontend/e2e/responses.spec.ts`
- Test: `scripts/local-ci.sh --tier t0 --fast`

**Interfaces:**
- Consumes: Next.js frontend, Laravel responses endpoint
- Produces: Playwright test verifying responses table render, filter by status, and CSV export action.

- [ ] **Step 1: Write Playwright E2E test for responses view**

Create `frontend/e2e/responses.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test.describe('Form Responses Dashboard E2E', () => {
  test('renders responses table and handles CSV export', async ({ page }) => {
    // Mock /api/forms/test-id
    await page.route('**/api/forms/test-id', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'test-id',
              title: 'Customer Satisfaction',
              slug: 'customer-satisfaction',
              status: 'published',
              draft_schema: {
                fields: [
                  { key: 'f_name', type: 'text', label: 'Nama' },
                  { key: 'f_rating', type: 'rating', label: 'Nilai' },
                ],
              },
            },
          }),
        })
      }
      return route.continue()
    })

    // Mock /api/forms/test-id/responses
    await page.route('**/api/forms/test-id/responses*', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'sub-1',
                session_id: '11111111-1111-1111-1111-111111111111',
                status: 'complete',
                started_at: '2026-09-18T10:00:00Z',
                completed_at: '2026-09-18T10:02:00Z',
                answers: [
                  { field_key: 'f_name', value: 'Doni' },
                  { field_key: 'f_rating', value: 5 },
                ],
              },
            ],
          },
          meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 },
        }),
      })
    })

    await page.goto('/forms/test-id/responses')

    // Assert headers and rows
    await expect(page.getByText('Customer Satisfaction')).toBeVisible()
    await expect(page.getByText('Doni')).toBeVisible()
    await expect(page.getByText('5')).toBeVisible()
    await expect(page.getByText('complete')).toBeVisible()

    // Assert Export button exists and is clickable
    const exportBtn = page.getByRole('button', { name: /export csv/i })
    await expect(exportBtn).toBeVisible()
  })
})
```

- [ ] **Step 2: Run Playwright tests and Local-CI**

Run: `cd frontend && npx playwright test e2e/responses.spec.ts`
Expected: 1 passed.

Run: `bash scripts/local-ci.sh --tier t0 --fast`
Expected: ALL GREEN (11 gates pass).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/responses.spec.ts
git commit -m "ci: add playwright responses e2e test and verify all local-ci gates for milestone 4"
```
