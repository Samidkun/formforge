# ADR 4: Partial Submission Idempotency via Composite Unique Key

## Status
Accepted (Milestone 4 & 7)

## Context
FormForge supports autosaving partial responses as users fill out long forms to prevent data loss. The frontend periodically issues debounced `POST /f/:slug/submit` calls with `status: "partial"`. Without idempotency control, each autosave pulse would create duplicate submission records, polluting response tables and inflating completion metrics.

## Decision
1. **Unique Session Key:**
   The `submissions` table enforces a composite unique constraint: `UNIQUE (form_id, session_id)`.
2. **Atomic Upsert in Storage Engine:**
   Both the Go edge service (`UpsertSubmission`) and Laravel backend use atomic upsert:
   - If a submission row with `(form_id, session_id)` exists, update `status`, `updated_at`, and replace/merge the `answers` JSON payload.
   - If no row exists, insert a new record.
3. **Transition to Complete:**
   When the user finally clicks Submit, the frontend sends `status: "complete"` with the exact same `session_id`. The existing draft record is upgraded to `complete` in place without generating a secondary row.

## Consequences
- **Positive:** Guarantees exactly one database row per respondent session. Partial drafts cleanly transition to completed submissions without duplicate records or orphaned drafts.
- **Negative:** Requires clients to maintain a consistent `session_id` in `sessionStorage` throughout a browsing session.
