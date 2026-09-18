# Plan 6: Analytics (Milestone 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deep field-level analytics pipeline: Postgres tables `form_events` and `form_daily_stats`, Go edge service event intake (`POST /f/:slug/event`), Laravel daily rollup queue job & analytics endpoint (`GET /api/forms/:id/analytics`), Next.js public form event instrumentation (views, starts, completes, field blur/focus), and technical instrument panel Analytics Dashboard (funnel chart + field dropout breakdown).

**Architecture:**
- **Edge Ingestion (Go):**
  - `POST /f/:slug/event`: receives telemetry `{ session_id, type: "view"|"start"|"complete"|"field_focus"|"field_blur", field_key? }`.
  - Records into `form_events` table (append-only) via fast parameterized SQL.
- **Database (Postgres):**
  - `form_events`: `id` (bigint/uuid), `form_id`, `session_id`, `type`, `field_key`, `created_at`.
  - `form_daily_stats`: `id`, `form_id`, `date`, `views`, `starts`, `completes`, timestamps.
- **Aggregation & Backend API (Laravel):**
  - `RollupDailyStatsJob`: aggregates daily events into `form_daily_stats`.
  - `AnalyticsController::show`: computes funnel conversion rate + per-field dropout percentage comparing field interactions against subsequent completions.
- **Frontend (Next.js):**
  - Public Form tracker (`FormRenderer.tsx` / `app/f/[slug]/page.tsx`): emits `view` on mount, `start` on first interaction, `complete` on submission, `field_blur` on leaving a field.
  - Analytics Dashboard (`AnalyticsDashboard.tsx` & `/forms/[id]/analytics/page.tsx`): technical instrument panel (Rukun tokens `#16181C`, `#1E2228`, `#C7F53B`, `#4EE5B6`, `#FF4D4D`, `#F4F5F6`) showing KPI metric cards, funnel visualizer, and field dropout analysis table.

**Tech Stack:** Laravel 12, PHPUnit 12, Go 1.27, Next.js 16 (React 19, TypeScript 5.9.3, Tailwind CSS v4), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md` §3.1, §4 (D2), §5.2, §8 (Milestone 6)

---

### Task 1: Backend Database Migrations & Models for Form Events & Daily Stats

**Files:**
- Create: `backend/database/migrations/2026_09_18_000005_create_form_events_table.php`
- Create: `backend/database/migrations/2026_09_18_000006_create_form_daily_stats_table.php`
- Create: `backend/app/Models/FormEvent.php`
- Create: `backend/app/Models/FormDailyStat.php`
- Modify: `backend/app/Models/Form.php`
- Test: `backend/tests/Feature/FormAnalyticsModelTest.php`

**Interfaces:**
- Produces: `form_events` and `form_daily_stats` tables with Eloquent relations on `Form`:
  - `$form->events()`: HasMany `FormEvent`
  - `$form->dailyStats()`: HasMany `FormDailyStat`

- [x] **Step 1: Write failing feature test for models and migrations**

In `backend/tests/Feature/FormAnalyticsModelTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormDailyStat;
use App\Models\FormEvent;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FormAnalyticsModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_form_has_events_and_daily_stats_relations(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'WS', 'owner_id' => $user->id]);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Analytics Test Form',
            'slug' => 'analytics-test',
        ]);

        $sessionId = (string) Str::uuid();

        $event = $form->events()->create([
            'session_id' => $sessionId,
            'type' => 'view',
        ]);

        $daily = $form->dailyStats()->create([
            'date' => now()->toDateString(),
            'views' => 10,
            'starts' => 5,
            'completes' => 2,
        ]);

        $this->assertDatabaseHas('form_events', [
            'id' => $event->id,
            'form_id' => $form->id,
            'type' => 'view',
        ]);

        $this->assertDatabaseHas('form_daily_stats', [
            'id' => $daily->id,
            'form_id' => $form->id,
            'views' => 10,
        ]);

        $this->assertCount(1, $form->events);
        $this->assertCount(1, $form->dailyStats);
    }
}
```

- [x] **Step 2: Run test to confirm it fails**

Run: `cd backend && php artisan test tests/Feature/FormAnalyticsModelTest.php`
Expected: FAIL (table not found).

- [x] **Step 3: Implement migrations and Eloquent models**

1. Create migration `2026_09_18_000005_create_form_events_table.php`:
   - `id`: bigIncrements / uuid
   - `form_id`: foreignUuid('forms')->cascadeOnDelete()
   - `session_id`: uuid
   - `type`: string(32) ('view', 'start', 'complete', 'field_focus', 'field_blur')
   - `field_key`: string(64)->nullable()
   - `created_at`: timestamp default current
   - Indexes: `['form_id', 'type']`, `['form_id', 'created_at']`, `['session_id']`

2. Create migration `2026_09_18_000006_create_form_daily_stats_table.php`:
   - `id`: bigIncrements
   - `form_id`: foreignUuid('forms')->cascadeOnDelete()
   - `date`: date
   - `views`: unsignedInteger default 0
   - `starts`: unsignedInteger default 0
   - `completes`: unsignedInteger default 0
   - `timestamps`
   - Unique: `['form_id', 'date']`

3. Create `FormEvent.php` and `FormDailyStat.php` with mass assignment guards.
4. Add `events()` and `dailyStats()` HasMany relations to `Form.php`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd backend && php artisan test tests/Feature/FormAnalyticsModelTest.php`
Expected: PASS.

- [x] **Step 5: Run full backend test suite**

Run: `cd backend && php artisan test`
Expected: 80+ tests pass.

- [x] **Step 6: Commit**

```bash
git add backend/database/migrations/ backend/app/Models/ backend/tests/Feature/FormAnalyticsModelTest.php
git commit -m "feat(backend): add migrations and models for form_events and form_daily_stats"
```

---

### Task 2: Go Edge Service `POST /f/:slug/event` Intake & Persistence

**Files:**
- Modify: `edge/internal/handler/handler.go`
- Modify: `edge/internal/db/db.go`
- Test: `edge/internal/handler/handler_test.go`

**Interfaces:**
- Consumes: `POST /f/:slug/event` with JSON `{ session_id, type, field_key? }`
- Produces: Validates `session_id` (UUID) and event `type`, looks up published form, and inserts row into `form_events`. Returns `204 No Content`.

- [x] **Step 1: Write failing Go tests for event intake**

In `edge/internal/handler/handler_test.go`:
- Test `POST /f/test-slug/event` with valid `view` event calls `RecordEvent` with expected parameters and returns 204.
- Test `POST /f/test-slug/event` with invalid `session_id` returns 422.
- Test `POST /f/test-slug/event` with invalid `type` returns 422.
- Test `POST /f/test-slug/event` for non-existent form returns 404.

- [x] **Step 2: Run Go tests to confirm failure**

Run: `cd edge && go test ./internal/handler`
Expected: FAIL.

- [x] **Step 3: Implement handler and database record execution**

In `edge/internal/handler/handler.go`:
- Define `EventPayload`: `SessionID string`, `Type string`, `FieldKey *string`.
- In `ServeHTTP`: route `POST /f/:slug/event` to `h.handleEvent(w, r, slug)`.
- In `handleEvent`:
  - Fetch published form to verify it exists and retrieve `form_id`.
  - Validate `uuidRegex.MatchString(payload.SessionID)`.
  - Validate `Type` in `["view", "start", "complete", "field_focus", "field_blur"]`.
  - Call `h.store.RecordEvent(r.Context(), &EventRecord{...})`.
  - Return `204 No Content`.

In `edge/internal/db/db.go`:
- Implement `RecordEvent` with SQL query:
  `INSERT INTO form_events (form_id, session_id, type, field_key, created_at) VALUES ($1, $2, $3, $4, NOW())`.

- [x] **Step 4: Run Go tests to verify pass**

Run: `cd edge && go test -v ./... && go vet ./...`
Expected: PASS with 0 errors.

- [x] **Step 5: Commit**

```bash
git add edge/internal/handler/ edge/internal/db/
git commit -m "feat(edge): implement event intake and database recording for public form telemetry"
```

---

### Task 3: Backend Analytics Rollup Job & Analytics API

**Files:**
- Create: `backend/app/Jobs/RollupFormAnalyticsJob.php`
- Create: `backend/app/Http/Controllers/Api/AnalyticsController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/AnalyticsApiTest.php`

**Interfaces:**
- Consumes: `GET /api/forms/{id}/analytics`
- Produces: JSON response with:
  - `funnel`: `{ views: int, starts: int, completes: int, conversion_rate: float }`
  - `dropoff`: array of per-field metrics `[{ field_key: string, label: string, interactions: int, dropouts: int, drop_rate: float }]`
  - `daily`: array of daily aggregated views, starts, completes

- [x] **Step 1: Write failing feature test for analytics endpoint and rollup**

In `backend/tests/Feature/AnalyticsApiTest.php`:
- Authenticated user can view analytics for their form.
- Other user receives 403 Forbidden under `FormPolicy`.
- Accurately computes funnel counts and completion rates.
- Accurately calculates field dropouts based on interaction and submission data.

- [x] **Step 2: Run test to confirm failure**

Run: `cd backend && php artisan test tests/Feature/AnalyticsApiTest.php`
Expected: FAIL (route / controller not found).

- [x] **Step 3: Implement Rollup Job and AnalyticsController**

1. Create `RollupFormAnalyticsJob.php`:
   - Summarizes daily views, starts, completes into `form_daily_stats` using `upsert`.
2. Create `AnalyticsController.php`:
   - Enforce `Gate::authorize('view', $form)`.
   - Compute total `views`, `starts`, `completes` from `form_events` (or `form_daily_stats`).
   - For dropoff: inspect form schema fields sequence, count sessions interacting with each field vs sessions completing the form.
   - Return clean standardized JSON response.
3. Register route in `backend/routes/api.php`:
   `Route::get('/forms/{id}/analytics', [AnalyticsController::class, 'show']);`

- [x] **Step 4: Run backend tests to verify pass**

Run: `cd backend && php artisan test`
Expected: 80+ tests pass.

- [x] **Step 5: Commit**

```bash
git add backend/app/Jobs/ backend/app/Http/Controllers/Api/AnalyticsController.php backend/routes/api.php backend/tests/Feature/AnalyticsApiTest.php
git commit -m "feat(backend): add analytics rollup computation and GET /api/forms/{id}/analytics endpoint"
```

---

### Task 4: Frontend Public Form Event Tracking Instrumentation

**Files:**
- Modify: `frontend/src/renderer/FormRenderer.tsx`
- Modify: `frontend/src/app/f/[slug]/page.tsx`
- Test: `frontend/src/renderer/FormRenderer.test.tsx`
- Test: `frontend/src/app/f/[slug]/page.test.tsx`

**Interfaces:**
- Produces: Client-side event dispatcher emitting `view` on mount, `start` on initial input change/focus, `field_blur` on input blur, and `complete` upon submission.

- [x] **Step 1: Write failing tests for client event tracking**

In `frontend/src/renderer/FormRenderer.test.tsx`:
- Test that on initial field change/interaction, an onEvent callback or edge event POST is triggered with `type: 'start'`.
- Test that on field blur, a `field_blur` event is triggered with the corresponding `field_key`.

- [x] **Step 2: Run test to confirm failure**

Run: `cd frontend && npm test src/renderer/FormRenderer.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement event tracking in FormRenderer and public page**

- Add `onEvent?: (type: string, fieldKey?: string) => void` prop to `FormRenderer`.
- On first field focus or value input change, fire `onEvent('start')`.
- On input blur for any field, fire `onEvent('field_blur', field.key)`.
- In `frontend/src/app/f/[slug]/page.tsx`:
  - Manage a persistent `session_id` (UUID generated via `crypto.randomUUID()` and stored in `sessionStorage`).
  - Send `POST /f/:slug/event` (`view`) on page mount.
  - Wire `onEvent` callback from `FormRenderer` to send `POST /f/:slug/event` with `session_id`, `type`, and optional `field_key`.

- [x] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test`
Expected: All Vitest tests pass.

- [x] **Step 5: Commit**

```bash
git add frontend/src/renderer/ frontend/src/app/f/
git commit -m "feat(frontend): instrument public form renderer with telemetry events"
```

---

### Task 5: Frontend Analytics API Client & Dashboard Components

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`
- Create: `frontend/src/analytics/types.ts`
- Create: `frontend/src/analytics/components/AnalyticsDashboard.tsx`
- Test: `frontend/src/analytics/components/AnalyticsDashboard.test.tsx`

**Interfaces:**
- `api.getAnalytics(formId, token)`: fetches analytics summary from backend.
- `AnalyticsDashboard`: renders KPI cards (Views, Starts, Completes, Conversion Rate), Funnel visualizer bar chart, and Field Dropout Table using Rukun design tokens.

- [x] **Step 1: Write failing tests for getAnalytics API client and Dashboard component**

In `frontend/src/lib/api.test.ts`:
- Test `getAnalytics` requests `GET /api/forms/:id/analytics` with proper headers.

In `frontend/src/analytics/components/AnalyticsDashboard.test.tsx`:
- Test renders KPI metric cards with correct numbers and percentages.
- Test renders funnel bar chart representing views, starts, and completes.
- Test renders field dropout breakdown table showing field names, interactions, and drop rates.

- [x] **Step 2: Run tests to confirm failure**

Run: `cd frontend && npm test src/lib/api.test.ts src/analytics/components/AnalyticsDashboard.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement getAnalytics API client and AnalyticsDashboard component**

1. In `frontend/src/lib/api.ts`:
   - Export `getAnalytics(formId: string, token?: string): Promise<AnalyticsResult>`.
2. In `frontend/src/analytics/types.ts`:
   - Export `FunnelMetrics`, `FieldDropoff`, `DailyStat`, `AnalyticsData`.
3. In `frontend/src/analytics/components/AnalyticsDashboard.tsx`:
   - Dark technical instrument styling (`var(--color-bg-primary)`, `var(--color-surface-primary)`, `var(--color-accent-primary)`).
   - Metric cards: Total Views, Starts, Submissions, Conversion Rate (%).
   - Funnel component: visual step bars showing relative drop between View -> Start -> Complete.
   - Field Dropoff Table: columns: No, Field Name, Tipe, Interaksi, Dropouts, Dropout Rate.

- [x] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test`
Expected: PASS.

- [x] **Step 5: Run lint and typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/analytics/
git commit -m "feat(frontend): add analytics API client and instrument panel dashboard component"
```

---

### Task 6: Frontend Analytics Route & Tab Navigation

**Files:**
- Create: `frontend/src/app/forms/[id]/analytics/page.tsx`
- Test: `frontend/src/app/forms/[id]/analytics/page.test.tsx`
- Modify: `frontend/src/builder/components/BuilderView.tsx`
- Modify: `frontend/src/app/forms/[id]/responses/page.tsx`

**Interfaces:**
- Produces: Route `/forms/[id]/analytics` loading and displaying `AnalyticsDashboard`.
- Navigation tabs updated across all 3 form views (`Builder` | `Responses` | `Analytics`).

- [ ] **Step 1: Write failing page test for `/forms/[id]/analytics`**

In `frontend/src/app/forms/[id]/analytics/page.test.tsx`:
- Test renders form title and navigation tabs (`Builder`, `Responses`, `Analytics`).
- Test displays loading state while fetching analytics.
- Test renders dashboard with metrics upon successful fetch.
- Test renders error state if API fails.

- [ ] **Step 2: Run test to confirm failure**

Run: `cd frontend && npm test src/app/forms/[id]/analytics/page.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `/forms/[id]/analytics/page.tsx` and update tab navigation**

1. In `frontend/src/app/forms/[id]/analytics/page.tsx`:
   - Extract `id` from params.
   - Fetch form details and analytics in parallel using `api.fetchForm` and `api.getAnalytics`.
   - Render header with tabs (`Builder`, `Responses`, `Analytics` as active).
   - Render `<AnalyticsDashboard data={analyticsData} />`.
2. In `frontend/src/builder/components/BuilderView.tsx`:
   - Add `<Link href="/forms/:id/analytics">Analytics</Link>` in navigation tabs.
3. In `frontend/src/app/forms/[id]/responses/page.tsx`:
   - Add `<Link href="/forms/:id/analytics">Analytics</Link>` in navigation tabs.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test`
Expected: PASS.

- [ ] **Step 5: Run lint and typecheck**

Run: `cd frontend && npm run lint && npm run typecheck`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/forms/[id]/analytics/ frontend/src/builder/components/BuilderView.tsx frontend/src/app/forms/[id]/responses/page.tsx
git commit -m "feat(frontend): add /forms/[id]/analytics page route and update unified navigation tabs"
```

---

### Task 7: Gerbang Milestone 6 — Local-CI & Playwright E2E Analytics Test

**Files:**
- Create: `frontend/e2e/analytics.spec.ts`
- Test: `scripts/local-ci.sh --tier t0 --fast`

**Interfaces:**
- Produces: Playwright test verifying the full analytics flow: navigating to `/forms/:id/analytics`, viewing KPI metric cards, funnel visualizer, and field dropout table.
- All 11 local-ci gates passing cleanly.

- [ ] **Step 1: Write Playwright E2E test for Analytics**

Create `frontend/e2e/analytics.spec.ts`:
- Mock `GET /api/forms/:id`
- Mock `GET /api/forms/:id/analytics` with sample funnel and dropoff data
- Navigate to `/forms/form-123/analytics`
- Assert navigation tab "Analytics" is marked active (`aria-current="page"`)
- Assert KPI metric cards render (e.g. Total Views, Conversion Rate)
- Assert field dropout table renders field entries
- Click tab "Responses" or "Builder" to verify tab navigation works

- [ ] **Step 2: Run Playwright test**

Run: `cd frontend && npx playwright test e2e/analytics.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run full local-ci gate**

Run: `bash scripts/local-ci.sh --tier t0 --fast`
Expected: ALL GREEN (11/11 gates pass).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/analytics.spec.ts
git commit -m "ci: add playwright analytics e2e test and verify all local-ci gates for milestone 6"
```
