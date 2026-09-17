# FormForge — Design Spec

**Tier:** T0 — Personal (portofolio, tanpa user, tanpa revenue)
**Tanggal:** 2026-09-17
**Status:** Menunggu review user
**SOP:** `web-app-sop` v1.0.0 — Stage 3 (Spec)

> Tier ditulis di atas karena itu hal pertama yang pembaca berikutnya butuh tahu.
> Konsekuensi T0: docs/E2E/UAT **opsional**; prompt-roast + brainstorm + TDD untuk
> logika nyata + lint + secret scan **wajib**.

---

## 1. Positioning (jujur, hasil riset)

**Satu kalimat:** FormForge adalah **form builder open-source dengan analitik
field-level yang dalam** — menggabungkan builder + funnel/dropout per-field dalam
satu produk self-hosted.

**Klaim yang TIDAK boleh dibuat di README** (semua ini sudah dibantah riset):

- ❌ "Partial submission itu pembeda" — Formbricks punya gratis, Tally, Zoho,
  Gravity Forms, Formstack juga punya.
- ❌ "Dropout per-field itu hal baru" — Zuko (sejak 2014) & Exatom sudah
  melakukannya jauh lebih dalam (error rate, hesitation time, field returns).
- ❌ "Mengisi pasar kosong" — Formbricks (AGPL, 12k+ stars) sudah jadi
  open-source form builder lengkap dengan stack serupa.

**Klaim yang BOLEH dibuat** (gap yang beneran terverifikasi):

- ✅ Formbricks open-source **analitiknya dangkal** (review independen:
  *"Analytics and reporting dashboards could be more detailed"*).
- ✅ Zuko/Exatom punya analitik dalam, **tapi proprietary, mahal, dan hanya
  overlay** — mereka tidak punya builder.
- ✅ **Belum ada tool open-source yang menyatukan builder + analitik field-level
  dalam.** Itu celah yang FormForge isi.

**Nilai utama project ini = showcase engineering** (versioned schema, split
architecture yang dipertanggungjawabkan, TDD, pipeline analytics). README harus
menyatakan ini eksplisit — bukan mengklaim inovasi pasar.

---

## 2. Ruang Lingkup

### In scope (MVP, rilis pertama)

1. Multi-user: register/login, tiap user punya workspace + form sendiri.
2. Builder drag-drop: field palette + config panel.
3. Field types: text, email, number, long text, single choice, multi choice,
   rating, date, **file upload**.
4. Publish → public link (`/f/:slug`).
5. Public renderer: render form dari schema + submit.
6. **Partial submissions**: autosave jawaban walau belum di-submit.
7. Responses view + export CSV.
8. **Analytics**: funnel (view→start→complete) + dropout per-field.
9. Conditional logic (show/hide + required).
10. Versioning: edit form yang sudah publish bikin versi baru; submission lama
    tetap nunjuk versi lama.

### Out of scope (sengaja, dicatat sebagai exclusion)

- Billing / payment / plan tier.
- Template gallery, branding custom, white-label.
- Webhook + email notification (backlog, bukan MVP).
- Embeddable widget (`<script> embed`) — backlog.
- Realtime collaborative editing di builder — backlog.
- i18n / multi-bahasa.
- Mobile app.
- SSO / SAML.

Setiap item di atas adalah **pengecualian sadar** untuk Tier T0, bukan kelalaian.

---

## 3. Arsitektur

### 3.1 Diagram

```
                 ┌──────────────────────────┐
   Browser ──────┤  Next.js (builder + dash) │──┐
                 └──────────────────────────┘  │ authenticated REST
                                               ▼
                 ┌──────────────────────────┐  ┌────────────────────────┐
   Browser ──────┤  Go edge (PUBLIC, no auth)│  │  Laravel core (domain)  │
   (form fill)   │  read schema, write subs  │  │  auth, CRUD, versioning │
                 └────────────┬─────────────┘  └───────────┬────────────┘
                              │                             │
                         ┌────▼─────────────────────────────▼────┐
                         │  Postgres (satu DB, dua peran)         │
                         │  + Redis (cache schema, queue)         │
                         └────────────────────────────────────────┘
```

### 3.2 Boundary (yang harus dipertanggungjawabkan)

**Go edge — publik, stateless, tanpa session auth.**
Hanya 3 tanggung jawab:
- `GET /f/:slug` → baca schema versi publish (dari cache Redis, fallback DB).
- `POST /f/:slug/submit` → tulis submission (partial atau complete).
- `POST /f/:slug/event` → tulis event analytics.

Aturan keras: **Go edge tidak pernah memanggil Laravel saat request.** Kalau
butuh, split-nya gagal dan harus jadi monolith. Go edge di-rate-limit per-IP +
per-form.

**Laravel core — semua yang butuh auth + domain.**
Auth, workspace, CRUD form, versioning, file upload, rollup analytics (queue
job), export CSV.

**Next.js — UI.**
Public form page (`/f/[slug]`) SSR, ambil schema dari Go edge. Builder +
dashboard memanggil Laravel API.

### 3.3 Alasan split (jujur)

Bukan karena traffic (belum ada user). Alasan yang sah:

1. **Pola akses DB berbeda.** Core = baca-tulis domain kecil & kompleks. Edge =
   *append-heavy* (banyak write kecil dari partial submission + events) + read
   schema yang cache-able.
2. **Graceful degradation.** Core bisa restart/deploy tanpa membuat form publik
   ikut mati — edge tetap melayani read + write ke tabelnya sendiri.
3. **Permukaan keamanan terpisah.** Edge adalah satu-satunya endpoint tanpa auth;
   mengisolasinya membuat rate-limit + spam protection terfokus.

**Syarat agar split ini bukan dekorasi** (kalau dilanggar → balik ke monolith):
- Go edge stateless (no shared session).
- Satu Postgres, dua peran tabel yang jelas (domain vs append-only).
- Kontrak API ditulis eksplisit (bagian 3.4).

### 3.4 Kontrak API (eksplisit)

**Go edge (publik):**

| Method | Path | Body / Query | Response |
|---|---|---|---|
| `GET` | `/f/:slug` | — | `200 {schema, version_id, settings}` · `404` kalau tidak publish |
| `POST` | `/f/:slug/submit` | `{session_id, status: partial\|complete, answers: [{field_key, value}], meta}` | `200 {submission_id, status}` · `422` validasi gagal · `429` rate limited |
| `POST` | `/f/:slug/event` | `{session_id, type, field_key?}` | `204` |

Envelope seragam: `{success, data|error, meta}`.

**Laravel core (butuh auth, kecuali ditandai):**

| Method | Path | Auth | Guna |
|---|---|---|---|
| `POST` | `/api/register` | publik | daftar akun |
| `POST` | `/api/login` | publik | login |
| `GET/POST` | `/api/forms` | ✅ | list / buat form |
| `GET/PATCH/DELETE` | `/api/forms/:id` | ✅ | detail / ubah / hapus |
| `POST` | `/api/forms/:id/publish` | ✅ | publish versi baru |
| `GET` | `/api/forms/:id/responses` | ✅ | list respons (paginated) |
| `GET` | `/api/forms/:id/responses/export` | ✅ | CSV |
| `GET` | `/api/forms/:id/analytics` | ✅ | funnel + dropout per-field |
| `POST` | `/api/uploads` | ✅ | file upload (validasi tipe + ukuran) |

---

## 4. Data Model (Postgres)

| Tabel | Kolom kunci | Catatan |
|---|---|---|
| `users` | `id, email, password_hash` | multi-user |
| `workspaces` | `id, owner_id, name` | 1 user = 1+ workspace |
| `forms` | `id, workspace_id, title, slug (unik), status (draft/published/closed), current_version_id, settings jsonb` | |
| `form_versions` | `id, form_id, version_no, schema jsonb, published_at` | **immutable setelah publish** |
| `submissions` | `id, form_id, form_version_id, session_id, status (partial/complete), started_at, completed_at, meta jsonb` | key unik: `(form_id, session_id)` |
| `submission_answers` | `id, submission_id, field_key, value jsonb` | |
| `form_events` | `id, form_id, session_id, type (view/start/complete/field_focus/field_blur), field_key?, ts` | **append-only** |
| `uploads` | `id, form_id, submission_id, filename, mime, size, storage_path` | |
| `form_daily_stats` | `form_id, date, views, starts, completes` | hasil rollup job |

### Keputusan desain kunci (mahal dibalikin → ditandai)

**D1 — `form_versions.schema` = single source of truth.**
Builder menulis versi baru. Renderer membaca versi. Edit form yang sudah publish
**membuat versi baru**; submission lama tetap menunjuk `form_version_id` lama.
Jaminan: data historis tidak pernah rusak oleh edit schema.

**D2 — `form_events` append-only + rollup harian.**
Query analytics yang berat dipindah ke job queue → tabel `form_daily_stats`.
Dashboard tetap ringan walau event jutaan.

**D3 — Partial submission = upsert baris `submissions`.**
Bukan tabel terpisah. Di-key `(form_id, session_id)`. Satu mekanisme untuk
partial dan complete — `status` yang membedakan.

**D4 — Skema form disimpan sebagai JSONB, di-versioning.**
Field schema contoh:
```json
{
  "fields": [
    {"key": "f_1", "type": "text", "label": "Nama", "required": true},
    {"key": "f_2", "type": "email", "label": "Email", "required": true},
    {"key": "f_3", "type": "choice", "label": "Sumber", "options": ["A","B"],
     "logic": {"showIf": {"field": "f_2", "op": "filled"}}}
  ]
}
```

---

## 5. Alur Kunci

### 5.1 Partial submission

1. Buka form → JS bikin `session_id` (UUID) → kirim event `view` ke Go edge.
2. Interaksi pertama → event `start`.
3. User mengisi → **autosave debounce 3–5 detik** kalau ada perubahan →
   `POST /f/:slug/submit` dengan `status=partial` → **upsert** baris
   `(form_id, session_id)`.
4. Klik submit → `POST` dengan `status=complete` → finalisasi + event `complete`.
5. Kabur di tengah → baris `partial` tetap ada → ikut terhitung di analytics.

### 5.2 Analytics

- `form_events` → rollup harian (`form_daily_stats`) via Laravel queue job.
- **Funnel:** views → starts → completes.
- **Dropout per-field:** dari `field_focus`/`field_blur` + jawaban partial →
  "X% sesi yang sampai field Y tidak lanjut."

### 5.3 Versioning saat edit form publish

1. User edit form yang `status=published`.
2. Simpan draft (bukan langsung ubah versi publish).
3. Klik publish → buat baris `form_versions` baru (`version_no+1`) →
   update `forms.current_version_id`.
4. Submission lama tetap menunjuk `form_version_id` lama → render riwayat
   respons tetap akurat.

---

## 6. Design Contract (Stage 2 — Anti-Slop)

**Arah visual:** *technical instrument panel* — dark, padat informasi, mono untuk
angka/ID. **Meng-extend design system yang sudah ada di porto (Rukun)** — bukan
membuat sistem paralel.

**Token (diwarisi dari Rukun, bukan baru):**

| Token | Nilai | Pakai |
|---|---|---|
| `--bg-primary` | `#16181C` | kanvas |
| `--surface-primary` | `#1E2228` | kartu/panel |
| `--surface-elevated` | `#252A32` | dropdown/modal |
| `--border-hairline` | `#2A2E35` | garis pemisah |
| `--accent-primary` | `#C7F53B` | aksi utama (Electric Lime) |
| `--accent-success` | `#4EE5B6` | completion / funnel sukses |
| `--accent-warning` | `#F5A623` | partial / warning |
| `--accent-danger` | `#FF4D4D` | error / dropout tinggi |
| `--text-primary` | `#F4F5F6` | teks utama |
| `--text-secondary` | `#9DA5B4` | teks sekunder |
| `--text-muted` | `#5A6270` | teks muted |
| `--font-mono` | JetBrains Mono | angka, session ID, persentase |

**Ekstensi baru (dicatat alasannya):**
- `--chart-1..6` — palet kategorikal untuk chart funnel/dropout (turunan accent +
  hue tambahan, kontras ≥ 4.5:1).
- `--canvas-grid` + state drop-target/dragging untuk builder canvas.

**State wajib (happy-path-only = defect):** empty (belum ada form/respons),
loading (skeleton), error (gagal simpan/validasi), success (form publish,
submission masuk), disabled (tombol saat pending), edge (form 0 field, 1000
respons, teks panjang).

**Dilarang (penanda AI slop):** primary hitam pekat polos, tombol emoji generik,
grid kartu copy-paste, lorem/"Hello World", spacing ngabaikan sistem, novelty
tanpa alasan.

**Finish gate:** render & inspect sekali sebelum ship — benerin clipping,
overlap, media distorsi, kontrol tidak accessible, interaksi mati. Tiap elemen
interaktif reachable & focusable.

---

## 7. Testing & Gate (Tier T0)

**Wajib (T0):**
- **TDD untuk logika nyata** (IRON LAW: test gagal dulu, baru kode):
  - Laravel: versioning (schema immutable), validasi submission, **rollup
    aggregator** (pure function), funnel math.
  - Go: handler edge, validasi submission terhadap schema, rate limit.
  - Next: **reducer builder** (manipulasi schema = pure logic).
- **Lint + secret scan** — di-wire Stage 1.5 (bootstrap).
- **1 smoke test Playwright** begitu halaman pertama render (shift-left, murah).
- **Security baris "all":** validasi input di trust boundary (endpoint publik
  Go!), honeypot + rate limit, dependency audit, tidak ada secret plaintext.

**Opsional T0 (dicatat, boleh menyusul):** E2E suite lengkap, UAT, End-User
Guide + Runbook, threat model formal, security headers penuh, load test, SLO.

**Red flags yang berlaku:** kode sebelum test gagal; UI tanpa baca token
existing; klaim sukses tanpa menjalankan perintah fresh; progres cuma di kepala.

---

## 8. Milestone (8 weekend, santai)

| # | Fokus | Deliverable |
|---|---|---|
| 1 | Fondasi | Monorepo, Docker Compose (Postgres + Redis), Laravel auth + workspace, **skema JSON form final** |
| 2 | Builder UI | Drag-drop + field palette + config panel (semua field type) |
| 3 | Publish & Render | Publish flow, public link, renderer baca schema, submit tersimpan |
| 4 | Responses | Tabel respons, detail, **export CSV** |
| 5 | Logic | Conditional show/hide, required, validasi |
| 6 | Analytics | Track view/start/complete + field events, **funnel + dropout per-field**, chart |
| 7 | Partial + File Upload | Autosave partial submission, file upload (validasi tipe/ukuran), polish |
| 8 | Hardening & Packaging | Rate limit + honeypot, tests, README + demo video, ADR |

---

## 9. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Split 3-service jadi overhead | Proyek tidak kelar | Syarat §3.3 ditegakkan; kalau dilanggar → monolith |
| Scope creep ke billing/template | Tidak kelar | Out-of-scope §2 ditulis tegas |
| Analitik per-field salah hitung | Klaim palsu di README | Rollup aggregator = pure function + TDD |
| Partial submission duplikat | Data kotor | Upsert key `(form_id, session_id)` + test |
| Positioning dianggap "clone Formbricks" | Nilai porto turun | README §1 jujur: gap + klaim yang boleh/tidak |

---

## 10. Kriteria Selesai (T0)

1. Semua item "In scope" §2 berfungsi end-to-end di lingkungan lokal.
2. `scripts/local-ci.sh --fast` hijau (lint + secret scan + test).
3. Tidak ada defect known.
4. README jujur memuat §1 (positioning + gap), diagram arsitektur, cara jalan.
5. Demo video (opsional T0, dianjurkan).
6. ADR tercatat untuk D1–D4.
