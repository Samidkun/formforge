# ADR 3: Event-Driven Telemetry Ingestion with Asynchronous Daily Rollup

## Status
Accepted (Milestone 6)

## Context
FormForge provides per-field drop-off analytics, funnel conversion tracking (views -> starts -> completes), and time-to-complete metrics. Running aggregation queries (e.g. `COUNT(DISTINCT session_id)`, `GROUP BY field_key`) directly on live telemetry tables during dashboard visits would degrade database performance as event rows reach millions.

## Decision
Adopt a decoupled two-layer telemetry architecture:
1. **Append-Only Event Stream (`events` table):**
   Go edge writes raw events (`view`, `start`, `field_focus`, `field_blur`, `complete`) into an append-only table indexed by `(form_id, session_id, created_at)`.
2. **Asynchronous Aggregation (`form_daily_stats` table):**
   A scheduled background job (`RollupFormAnalyticsJob` running daily at midnight or triggered via `php artisan analytics:rollup`) aggregates raw events into pre-computed summary metrics:
   - `views`, `starts`, `completes`
   - `funnel` and `per_field_dropoff` JSON structures.
3. **Hybrid Dashboard Reads:**
   The analytics API serves pre-aggregated rows for historical days, with optional on-demand summation for the active 24-hour window.

## Consequences
- **Positive:** Dashboard loads in under 20ms regardless of raw event volume.
- **Negative:** Sub-second real-time analytics for past days are not needed; today's metrics are cached with short TTL.
