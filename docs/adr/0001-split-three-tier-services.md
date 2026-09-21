# ADR 1: Split Three-Tier Services (Laravel Core, Go Edge, Next.js Frontend)

## Status
Accepted (Milestone 1)

## Context
FormForge serves two fundamentally contrasting traffic patterns:
1. **Authenticated Management (Builder, Responses, Analytics, Auth):** Complex business logic, RBAC, workspaces, Eloquent ORM, exports, background jobs. Request volume is moderate, but transactional integrity and rich feature development speed are critical.
2. **Public Form Serving & High-Throughput Ingestion (`GET /f/:slug`, `POST /f/:slug/submit`, `POST /f/:slug/event`):** Anonymous, latency-sensitive traffic subject to viral spikes, bot scans, and high concurrency. Running full PHP framework bootstrapping per telemetry ping or field blur event creates unnecessary CPU and memory overhead.

## Decision
Split FormForge into three specialized services sharing a unified PostgreSQL and Redis data layer:
- **`backend/` (Laravel 12):** REST API for authenticated workspace members, schema publishing, file upload storage, response CSV exports, and daily rollup background queue workers.
- **`edge/` (Go 1.27):** Lightweight HTTP microservice handling public form retrieval and high-throughput ingestion of submissions and telemetry events with near-zero latency, minimal RAM footprint (<15MB), in-memory rate limiting, and honeypot validation.
- **`frontend/` (Next.js 16 + React 19):** Modern SSR/SPA client hosting both the administrative Form Builder / Analytics Dashboard and the public client-side dynamic `FormRenderer`.

## Consequences
- **Positive:** Edge ingestion handles thousands of requests per second without stressing PHP-FPM workers. Zero latency penalty for public end-users.
- **Negative:** Requires running multiple processes in development (mitigated via `docker-compose.yml` and unified `scripts/local-ci.sh`).
