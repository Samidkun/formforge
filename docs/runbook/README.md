# Developer Runbook — FormForge

**Tier:** T0 — Personal

## Environment (terverifikasi 2026-09-17)

Dicek langsung di mesin dev, bukan diasumsikan:

| Komponen | Status | Bukti |
|---|---|---|
| Docker daemon | ✅ active + enabled | `docker info` → `ServerVersion=29.8.0`, driver `overlayfs` |
| Akses Docker tanpa sudo | ✅ | user `samid` ada di grup `docker` |
| Docker Compose plugin | ✅ v5.5.1 | diinstall ke `~/.docker/cli-plugins/docker-compose` (tanpa sudo) |
| Postgres 18 (container) | ✅ healthy | `select version()` → `PostgreSQL 18.6` |
| Redis 7 (container) | ✅ healthy | `redis-cli ping` → `PONG` |
| JSONB | ✅ | `jsonb_build_object(...)` jalan |
| `gen_random_uuid()` | ✅ | mengembalikan UUID |
| PHP 8.5.10 / Composer 2.10.3 | ✅ | `php -v`, `composer -V` |
| Node 26.8.2 / npm 12.0.2 / pnpm 11.26.0 | ✅ | `node -v`, `npm -v`, `pnpm -v` |
| Go 1.27.1 | ✅ | `go version` |
| Playwright | ⬜ belum diinstall | `npx playwright install` (saat smoke test dibuat) |

### Catatan penting

- **Tidak ada git remote.** `.github/workflows/ci.yml` **tidak akan pernah jalan**.
  Satu-satunya gate adalah `bash scripts/local-ci.sh`. Ini disebut eksplisit oleh
  `bootstrap.sh` di bagian MANUAL STEPS.
- **Docker daemon harus sudah nyala** sebelum `docker compose up`. Kalau mati:
  `sudo systemctl start docker` (butuh password user, agent tidak bisa).
- Port yang dipakai: Postgres `5433` (host) → `5432` (container),
  Redis `6380` (host) → `6379` (container). Sengaja digeser agar tidak bentrok
  dengan instance Postgres/Redis lokal lain di mesin ini.

## Gate lokal

```bash
bash scripts/local-ci.sh --tier t0 --fast   # cepat: secret scan + lint + test
bash scripts/local-ci.sh --tier t0          # penuh (e2e/a11y/perf di-skip di T0)
```

## Struktur monorepo (rencana)

```
formforge/
├── backend/     # Laravel core (domain: auth, forms, versioning, analytics)
├── edge/        # Go edge (publik: render schema, ingest submission + events)
├── web/         # Next.js (builder + dashboard + public form page)
├── docker-compose.yml
├── scripts/     # local-ci.sh (dari factory)
└── docs/
```
