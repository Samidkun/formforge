# FormForge — Plan 1: Foundation (Milestone 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyiapkan fondasi FormForge: monorepo + Docker Compose (Postgres 18 + Redis 7) + Laravel core dengan auth multi-user, model Workspace, dan kontrak skema form JSON yang final dan teruji.

**Architecture:** Laravel 12 sebagai core domain (auth, workspace, forms). Skema form direpresentasikan sebagai **value object murni** (`FormSchema`) yang bisa divalidasi tanpa DB — ini fondasi untuk D1 (versioning) dan D4 (JSONB schema). Postgres 18 + Redis 7 jalan lewat Docker Compose.

**Tech Stack:** PHP 8.5, Laravel 12, Postgres 18 (container), Redis 7 (container), PHPUnit (bawaan Laravel), Docker Compose v5.

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md`

## Global Constraints

- **Tier:** T0 — Personal. Docs/E2E/UAT opsional; TDD untuk logika nyata wajib.
- **IRON LAW:** tidak ada production code tanpa test yang gagal lebih dulu.
- **Port (host):** Postgres `5433`, Redis `6380`.
- **Nama DB/user/pass dev:** `formforge` / `formforge` / `devpass`.
- **Auth:** multi-user (register/login), tiap user punya workspace.
- **DB test:** test memakai Postgres (bukan sqlite — ekstensi sqlite TIDAK ADA di
  mesin ini). Database test: `formforge_test`. Override di `backend/phpunit.xml`.
- **Redis client:** `predis/predis` + `REDIS_CLIENT=predis` (ekstensi phpredis
  TIDAK ADA di mesin ini).
- **Skema form disimpan JSONB**, field key berformat `f_<n>`.
- **Semua endpoint API pakai envelope:** `{success, data|error, meta}`.
- **Tidak ada secret plaintext.** `.env` di-gitignore; `.env.example` di-commit.
- **Commit kecil & conventional**, satu concern per commit.
- **Setiap task berakhir dengan test hijau + commit.**

---

### Task 1: Docker Compose untuk Postgres + Redis

**Files:**
- Create: `docker-compose.yml`
- Create: `scripts/wait-for-db.sh`
- Modify: `.env.example` (tambahkan kredensial dev)

**Interfaces:**
- Consumes: —
- Produces: service `db` (Postgres 18, host port 5433) & `cache` (Redis 7, host port 6380), keduanya punya healthcheck. `scripts/wait-for-db.sh` keluar 0 hanya setelah Postgres menerima koneksi.

- [ ] **Step 1: Tulis file compose**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: formforge
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: formforge
    ports: ["5433:5432"]
    volumes: ["pgdata:/var/lib/postgresql"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U formforge -d formforge"]
      interval: 3s
      timeout: 3s
      retries: 20

  cache:
    image: redis:7-alpine
    ports: ["6380:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 3s
      retries: 20

volumes:
  pgdata:
```

- [ ] **Step 2: Tulis helper tunggu DB**

```bash
#!/usr/bin/env bash
# scripts/wait-for-db.sh — keluar 0 hanya setelah Postgres siap,
# lalu pastikan database test `formforge_test` ada.
set -euo pipefail
for i in $(seq 1 40); do
  if docker compose exec -T db pg_isready -U formforge -d formforge >/dev/null 2>&1; then
    echo "db ready after ${i} attempt(s)"
    break
  fi
  sleep 2
done

# DB test terpisah (test TIDAK boleh jalan di DB dev).
if ! docker compose exec -T db psql -U formforge -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='formforge_test'" | grep -q 1; then
  docker compose exec -T db psql -U formforge -d postgres -c "CREATE DATABASE formforge_test"
  echo "created database formforge_test"
else
  echo "database formforge_test already exists"
fi
```

- [ ] **Step 3: Jalankan dan verifikasi (bukti nyata)**

Run:
```bash
chmod +x scripts/wait-for-db.sh
docker compose up -d
bash scripts/wait-for-db.sh
docker compose exec -T db psql -U formforge -d formforge -tAc "select version();"
docker compose exec -T cache redis-cli ping
```
Expected: `db ready after N attempt(s)` · `PostgreSQL 18.x` · `PONG`

- [ ] **Step 4: Tambahkan kredensial ke `.env.example`**

```
# Docker Compose dev (lihat docker-compose.yml)
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=formforge
DB_USERNAME=formforge
DB_PASSWORD=devpass

REDIS_HOST=127.0.0.1
REDIS_PORT=6380
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml scripts/wait-for-db.sh .env.example
git commit -m "chore: add docker compose for postgres 18 + redis 7"
```

---

### Task 2: Scaffold Laravel core + health endpoint

**Files:**
- Create: `backend/` (via `composer create-project`)
- Create: `backend/routes/api.php` (route health)
- Create: `backend/app/Http/Controllers/HealthController.php`
- Create: `backend/tests/Feature/HealthTest.php`
- Modify: `backend/.env` (koneksi DB ke container)

**Interfaces:**
- Consumes: service `db` dari Task 1.
- Produces: endpoint `GET /api/health` → `200 {"success":true,"data":{"db":"ok","cache":"ok"},"meta":{}}`. `HealthController::__invoke()`.

- [ ] **Step 1: Scaffold Laravel (installer — baca output-nya, jangan cuma exit code)**

Run:
```bash
cd /mnt/data/01_Projects/Porto/formforge
composer create-project laravel/laravel:^12.0 backend --no-interaction 2>&1 | tail -20
```
Expected: berakhir dengan "Application ready!" TANPA baris `error`. Kalau ada `error`, berhenti dan baca.

- [ ] **Step 2: Tulis test yang gagal**

```php
<?php
// backend/tests/Feature/HealthTest.php
namespace Tests\Feature;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_endpoint_reports_db_and_cache(): void
    {
        $res = $this->getJson('/api/health');
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.db', 'ok')
            ->assertJsonPath('data.cache', 'ok');
    }
}
```

- [ ] **Step 3: Run, verifikasi GAGAL**

Run: `cd backend && php artisan test --filter=HealthTest`
Expected: FAIL (404, route belum ada).

- [ ] **Step 4: Implementasi minimal**

```php
<?php
// backend/app/Http/Controllers/HealthController.php
namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class HealthController extends Controller
{
    public function __invoke()
    {
        $db = 'down';
        try { DB::select('select 1'); $db = 'ok'; } catch (\Throwable $e) {}

        $cache = 'down';
        try { Redis::connection()->ping(); $cache = 'ok'; } catch (\Throwable $e) {}

        return response()->json([
            'success' => true,
            'data'    => ['db' => $db, 'cache' => $cache],
            'meta'    => new \stdClass(),
        ]);
    }
}
```

```php
// tambahkan di backend/routes/api.php
use App\Http\Controllers\HealthController;
Route::get('/health', HealthController::class);
```

- [ ] **Step 5: Set `.env` + `phpunit.xml` ke container, install predis, run test**

Ekstensi PHP `redis` dan `sqlite` TIDAK ADA di mesin ini, jadi:

```
# backend/.env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5433
DB_DATABASE=formforge
DB_USERNAME=formforge
DB_PASSWORD=devpass
REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
```

Test memakai Postgres (bukan sqlite). Edit `backend/phpunit.xml` — di dalam
`<php>` tambahkan/ganti blok `<env>` berikut:

```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_HOST" value="127.0.0.1"/>
<env name="DB_PORT" value="5433"/>
<env name="DB_DATABASE" value="formforge_test"/>
<env name="DB_USERNAME" value="formforge"/>
<env name="DB_PASSWORD" value="devpass"/>
<env name="REDIS_CLIENT" value="predis"/>
<env name="CACHE_STORE" value="array"/>
<env name="QUEUE_CONNECTION" value="sync"/>
```

Install klien Redis PHP murni (ekstensi phpredis tidak ada):

```bash
cd backend && composer require predis/predis --no-interaction 2>&1 | tail -5
```

Run: `php artisan test --filter=HealthTest`
Expected: PASS (assertion hijau). Kalau gagal karena DB, pastikan
`bash scripts/wait-for-db.sh` sudah dijalankan (Task 1 Step 2 membuat `formforge_test`).

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(backend): scaffold laravel with health endpoint"
```

---

### Task 3: Value object `FormSchema` (kontrak skema form) — TDD murni

**Files:**
- Create: `backend/app/Domain/FormSchema.php`
- Create: `backend/app/Domain/FieldType.php`
- Create: `backend/tests/Unit/FormSchemaTest.php`

**Interfaces:**
- Consumes: —
- Produces:
  - `FieldType` enum: `Text, Email, Number, LongText, Choice, MultiChoice, Rating, Date, File`.
  - `FormSchema::fromArray(array $data): self` — melempar `InvalidArgumentException` kalau invalid.
  - `FormSchema::toArray(): array` — round-trip aman.
  - `FormSchema::fieldKeys(): array` — daftar `f_<n>` berurutan.
  - `FormSchema::validateAnswers(array $answers): array` — mengembalikan array error `['f_1' => 'Wajib diisi']`; array kosong = valid.

- [ ] **Step 1: Tulis test yang gagal**

```php
<?php
// backend/tests/Unit/FormSchemaTest.php
namespace Tests\Unit;

use App\Domain\FormSchema;
use PHPUnit\Framework\TestCase;

class FormSchemaTest extends TestCase
{
    private function validSchema(): array
    {
        return ['fields' => [
            ['key' => 'f_1', 'type' => 'text',  'label' => 'Nama',  'required' => true],
            ['key' => 'f_2', 'type' => 'email', 'label' => 'Email', 'required' => true],
            ['key' => 'f_3', 'type' => 'rating','label' => 'Nilai','required' => false],
        ]];
    }

    public function test_round_trip_is_lossless(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $this->assertSame($this->validSchema(), $s->toArray());
    }

    public function test_rejects_duplicate_field_keys(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => 'A', 'required' => true],
            ['key' => 'f_1', 'type' => 'text', 'label' => 'B', 'required' => true],
        ]]);
    }

    public function test_rejects_unknown_field_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'signature', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_requires_non_empty_label(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => '', 'required' => false],
        ]]);
    }

    public function test_required_field_missing_is_an_error(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $errors = $s->validateAnswers(['f_2' => 'a@b.com']);
        $this->assertArrayHasKey('f_1', $errors);
    }

    public function test_email_type_rejects_invalid_value(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $errors = $s->validateAnswers(['f_1' => 'Budi', 'f_2' => 'not-an-email']);
        $this->assertArrayHasKey('f_2', $errors);
    }

    public function test_valid_answers_produce_no_errors(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $this->assertSame([], $s->validateAnswers(['f_1' => 'Budi', 'f_2' => 'a@b.com']));
    }

    public function test_field_keys_are_listed_in_order(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $this->assertSame(['f_1', 'f_2', 'f_3'], $s->fieldKeys());
    }

    public function test_rating_out_of_range_is_an_error(): void
    {
        $s = FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'rating', 'label' => 'Nilai', 'required' => false],
        ]]);
        $this->assertSame(['f_1' => 'Rating harus 1-5'], $s->validateAnswers(['f_1' => 9]));
        $this->assertSame(['f_1' => 'Rating harus 1-5'], $s->validateAnswers(['f_1' => 0]));
        $this->assertSame([], $s->validateAnswers(['f_1' => 1]));
        $this->assertSame([], $s->validateAnswers(['f_1' => 5]));
    }

    public function test_number_type_rejects_non_numeric_value(): void
    {
        $s = FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'number', 'label' => 'Jumlah', 'required' => false],
        ]]);
        $this->assertSame(['f_1' => 'Harus berupa angka'], $s->validateAnswers(['f_1' => 'abc']));
        $this->assertSame([], $s->validateAnswers(['f_1' => '7']));
    }

    public function test_error_messages_are_exact_strings(): void
    {
        $s = FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text',   'label' => 'Nama',   'required' => true],
            ['key' => 'f_2', 'type' => 'email',  'label' => 'Email',  'required' => false],
            ['key' => 'f_3', 'type' => 'number', 'label' => 'Jumlah', 'required' => false],
            ['key' => 'f_4', 'type' => 'rating', 'label' => 'Nilai',  'required' => false],
        ]]);
        $errors = $s->validateAnswers(['f_2' => 'nope', 'f_3' => 'abc', 'f_4' => 9]);
        $this->assertSame('Wajib diisi', $errors['f_1']);
        $this->assertSame('Format email tidak valid', $errors['f_2']);
        $this->assertSame('Harus berupa angka', $errors['f_3']);
        $this->assertSame('Rating harus 1-5', $errors['f_4']);
    }

    public function test_rejects_non_string_field_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => ['text'], 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_missing_or_non_array_fields(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray([]);
    }

    public function test_rejects_non_array_fields_value(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => 'nope']);
    }

    public function test_rejects_missing_field_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_empty_or_non_string_key(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => '', 'type' => 'text', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_whitespace_only_label(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => '   ', 'required' => false],
        ]]);
    }

    public function test_rejects_non_string_key(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 123, 'type' => 'text', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_non_string_label(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => ['x'], 'required' => false],
        ]]);
    }
}
```

> **Catatan controller (Ruling T3-3b — sweep terakhir):** enumerasi SEMUA operand guard di `fromArray`
> menunjukkan 2 guard `!is_string` terakhir (`$f['key']`, `$f['label']`) masih real tapi nol coverage
> (hapusnya → `TypeError` bocor, bukan `InvalidArgumentException`). Test 18–19 menutupnya. Tiga operand
> `!isset($f['key'|'type'|'label'])` bersifat **redundan/dead** — operand `!is_string` sibling sudah
> menangkap kasus yang sama, jadi tak ada test yang bisa (atau perlu) menutupnya. Setelah 19 test ini,
> setiap guard yang *reachable dan non-redundan* di `FormSchema` punya test yang bisa gagal:
> **coverage-complete, sweep ditutup.**

> **Catatan controller (Ruling T3-3):** re-review menemukan 4 guard saudara yang masih nol coverage
> (kelas hole yang sama): `!isset($f['type'])`, key kosong/non-string, `fields` hilang/non-array, dan
> `trim($f['label']) === ''` (label whitespace-only). Test 13–17 menutup semuanya **exhaustive** —
> setiap guard di `fromArray` kini punya test yang bisa gagal. Ini sweep final; setelah ini FormSchema
> dinyatakan coverage-complete dan re-review berfokus verifikasi, bukan berburu gap tanpa batas.

> **Catatan controller (Ruling T3-1):** test ke-9 (`test_rating_out_of_range_is_an_error`) ditambahkan
> karena Step 6 (mutation check) awalnya tidak bisa gagal — tak ada test yang mengeksekusi cabang
> rating, sehingga `$n < 1 || $n > 5` bisa diganti `false` tanpa memerahkan suite. Test ini menutup
> cabang itu agar mutation check di Step 6 benar-benar load-bearing.
>
> **Catatan controller (Ruling T3-2):** review task-3 memutasi SETIAP rule dan menemukan 4 gap
> coverage yang sama kelasnya dengan T3-1: (a) rule `number` nol test — branch live tapi tak
> terproteksi; (b) bound bawah rating `< 1` belum teruji (T3-1 baru menutup `> 5`); (c) keempat
> string pesan error tak pernah di-assert (semua pakai `assertArrayHasKey`, mutasi pesan → tetap
> hijau); (d) `type` non-string (mis. array) melempar `TypeError`, bukan `InvalidArgumentException`
> sesuai kontrak. Tiga test baru (total suite 12) + guard `!is_string($f['type'])` di Step 4 menutup keempatnya.

- [ ] **Step 2: Run, verifikasi GAGAL**

Run: `cd backend && php artisan test --filter=FormSchemaTest`
Expected: FAIL — `Class "App\Domain\FormSchema" not found`.

- [ ] **Step 3: Implementasi `FieldType`**

```php
<?php
// backend/app/Domain/FieldType.php
namespace App\Domain;

enum FieldType: string
{
    case Text = 'text';
    case Email = 'email';
    case Number = 'number';
    case LongText = 'long_text';
    case Choice = 'choice';
    case MultiChoice = 'multi_choice';
    case Rating = 'rating';
    case Date = 'date';
    case File = 'file';
}
```

- [ ] **Step 4: Implementasi `FormSchema`**

```php
<?php
// backend/app/Domain/FormSchema.php
namespace App\Domain;

class FormSchema
{
    /** @param array<int, array<string, mixed>> $fields */
    private function __construct(private readonly array $fields) {}

    public static function fromArray(array $data): self
    {
        if (!array_key_exists('fields', $data) || !is_array($data['fields'])) {
            throw new \InvalidArgumentException('Schema must contain a "fields" array.');
        }

        $seen = [];
        foreach ($data['fields'] as $f) {
            if (!isset($f['key']) || !is_string($f['key']) || $f['key'] === '') {
                throw new \InvalidArgumentException('Every field needs a non-empty string key.');
            }
            if (isset($seen[$f['key']])) {
                throw new \InvalidArgumentException("Duplicate field key: {$f['key']}");
            }
            $seen[$f['key']] = true;

            if (!isset($f['type']) || !is_string($f['type']) || FieldType::tryFrom($f['type']) === null) {
                throw new \InvalidArgumentException("Unknown field type: " . (is_scalar($f['type'] ?? null) ? $f['type'] : gettype($f['type'] ?? null)));
            }
            if (!isset($f['label']) || !is_string($f['label']) || trim($f['label']) === '') {
                throw new \InvalidArgumentException("Field {$f['key']} needs a non-empty label.");
            }
        }

        return new self(array_values($data['fields']));
    }

    public function toArray(): array
    {
        return ['fields' => $this->fields];
    }

    /** @return array<int, string> */
    public function fieldKeys(): array
    {
        return array_map(fn ($f) => $f['key'], $this->fields);
    }

    /**
     * @param array<string, mixed> $answers
     * @return array<string, string> field_key => pesan error (kosong = valid)
     */
    public function validateAnswers(array $answers): array
    {
        $errors = [];
        foreach ($this->fields as $f) {
            $key   = $f['key'];
            $type  = FieldType::from($f['type']);
            $value = $answers[$key] ?? null;
            $empty = $value === null || $value === '' || $value === [];

            if ($empty) {
                if (!empty($f['required'])) {
                    $errors[$key] = 'Wajib diisi';
                }
                continue;
            }

            if ($type === FieldType::Email && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[$key] = 'Format email tidak valid';
            }
            if ($type === FieldType::Number && !is_numeric($value)) {
                $errors[$key] = 'Harus berupa angka';
            }
            if ($type === FieldType::Rating) {
                $n = (int) $value;
                if ($n < 1 || $n > 5) { $errors[$key] = 'Rating harus 1-5'; }
            }
        }
        return $errors;
    }
}
```

- [ ] **Step 5: Run, verifikasi PASS**

Run: `cd backend && php artisan test --filter=FormSchemaTest`
Expected: PASS (8 test).

- [ ] **Step 6: Mutation check (SOP: test yang nggak bisa gagal bukan test)**

Ubah sementara `$n < 1 || $n > 5` jadi `false`, jalankan ulang → test rating **harus merah**. Kembalikan → hijau.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Domain backend/tests/Unit/FormSchemaTest.php
git commit -m "feat(backend): add FormSchema value object with validation"
```

---

### Task 4: Migrasi + model `Workspace`

**Files:**
- Create: `backend/database/migrations/xxxx_create_workspaces_table.php`
- Create: `backend/app/Models/Workspace.php`
- Create: `backend/app/Models/User.php` (modifikasi: tambah relasi)
- Create: `backend/tests/Feature/WorkspaceTest.php`

**Interfaces:**
- Consumes: `users` (bawaan Laravel).
- Produces: tabel `workspaces(id uuid, owner_id FK users, name, timestamps)`; `Workspace` model dengan relasi `owner()` (belongsTo User) dan `User::workspaces()` (hasMany). UUID v4 via `gen_random_uuid()`.

- [ ] **Step 1: Tulis test yang gagal**

```php
<?php
// backend/tests/Feature/WorkspaceTest.php
namespace Tests\Feature;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_own_many_workspaces(): void
    {
        $user = User::factory()->create();
        Workspace::create(['owner_id' => $user->id, 'name' => 'Toko A']);
        Workspace::create(['owner_id' => $user->id, 'name' => 'Toko B']);

        $this->assertCount(2, $user->fresh()->workspaces);
        $this->assertSame(
            'Toko A',
            $user->workspaces()->orderBy('created_at')->orderBy('name')->first()->name
        );
    }

    public function test_workspace_belongs_to_owner(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'X']);
        $this->assertTrue($ws->owner->is($user));
    }

    public function test_workspace_id_is_uuid(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'X']);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $ws->id
        );
    }
}
```

- [ ] **Step 2: Run, verifikasi GAGAL**

Run: `cd backend && php artisan test --filter=WorkspaceTest`
Expected: FAIL — tabel/model belum ada.

- [ ] **Step 3: Migrasi**

```php
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
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
            $table->index('owner_id');
        });
    }
    public function down(): void { Schema::dropIfExists('workspaces'); }
};
```

- [ ] **Step 4: Model**

```php
<?php
// backend/app/Models/Workspace.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Workspace extends Model
{
    use HasUuids;
    protected $fillable = ['owner_id', 'name'];
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
}
```

```php
// tambahkan di backend/app/Models/User.php
public function workspaces(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(\App\Models\Workspace::class, 'owner_id');
}
```

> **Catatan controller (Ruling T4-1 — plan defect):** brief semula menulis `foreignUuid('owner_id')`,
> tapi `users.id` adalah `bigint` bawaan Laravel (`$table->id()`) → Postgres menolak FK
> ("incompatible types: uuid and bigint"), dan test maupun Task 5 memakai `owner_id => $user->id`
> (bigint). Maka `owner_id` harus `foreignId` (bigint), bukan uuid. `id` workspace tetap
> `uuid DEFAULT gen_random_uuid()`.
>
> **Catatan controller (Ruling T4-2 — UUID version):** prose "UUID v4" tidak akurat untuk jalur
> penulisan: kolom `id` punya default DB `gen_random_uuid()` (v4) tapi itu **tak terpakai** karena
> `HasUuids` (Laravel 12) men-generate **v7** di sisi klien. Test memakai regex version-agnostic,
> jadi tidak ada yang pecah. v7 (time-ordered) justru lebih baik untuk indeks. Kalau v4 ketat
> diwajibkan, ganti ke `HasVersion4Uuids` — tapi itu **bukan** keputusan default di sini.

- [ ] **Step 5: Jalankan migrasi + test**

Run: `php artisan migrate --force && php artisan test --filter=WorkspaceTest`
Expected: PASS (3 test).

> **Catatan controller (Ruling T4-3 — determinisme test):** review T4 menandai
> `test_user_can_own_many_workspaces` meng-assert urutan lewat `->first()` **tanpa `orderBy`** —
> urutan heap Postgres bersifat insidental, jadi test itu **latent flake** (bisa hijau/merah acak di
> data besar). Flaky test merusak sinyal hijau yang jadi fondasi metodologi ini, maka ini diperbaiki
> (bukan sekadar kosmetik): query eksplisit `->orderBy('created_at')->orderBy('name')`.

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations backend/app/Models
git commit -m "feat(backend): add workspaces table and model (uuid, owner)"
```

---

### Task 5: Auth API (register / login / me)

**Files:**
- Create: `backend/app/Http/Controllers/Api/AuthController.php`
- Create: `backend/app/Http/Requests/RegisterRequest.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/AuthApiTest.php`

**Interfaces:**
- Consumes: `users` (bawaan), `Workspace` (Task 4).
- Produces: endpoint publik `POST /api/register`, `POST /api/login`; endpoint terproteksi `GET /api/me`. Semua pakai envelope `{success, data|error, meta}`. Register otomatis membuat workspace default bernama `"<nama> Workspace"`.

- [ ] **Step 1: Tulis test yang gagal**

```php
<?php
// backend/tests/Feature/AuthApiTest.php
namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_user_and_default_workspace(): void
    {
        $res = $this->postJson('/api/register', [
            'name' => 'Samid', 'email' => 'samid@example.com',
            'password' => 'rahasia123', 'password_confirmation' => 'rahasia123',
        ]);
        $res->assertStatus(201)->assertJsonPath('success', true);
        $user = User::where('email', 'samid@example.com')->first();
        $this->assertNotNull($user);
        $this->assertCount(1, $user->workspaces);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'samid@example.com']);
        $this->postJson('/api/register', [
            'name' => 'X', 'email' => 'samid@example.com',
            'password' => 'rahasia123', 'password_confirmation' => 'rahasia123',
        ])->assertStatus(422)->assertJsonPath('success', false);
    }

    public function test_login_returns_token(): void
    {
        User::factory()->create([
            'email' => 'samid@example.com',
            'password' => bcrypt('rahasia123'),
        ]);
        $res = $this->postJson('/api/login', [
            'email' => 'samid@example.com', 'password' => 'rahasia123',
        ]);
        $res->assertStatus(200)->assertJsonPath('success', true);
        $this->assertNotEmpty($res->json('data.token'));
    }

    public function test_login_rejects_wrong_password(): void
    {
        User::factory()->create([
            'email' => 'samid@example.com', 'password' => bcrypt('rahasia123'),
        ]);
        $this->postJson('/api/login', [
            'email' => 'samid@example.com', 'password' => 'salah',
        ])->assertStatus(422);
    }

    public function test_me_requires_auth(): void
    {
        $this->getJson('/api/me')->assertStatus(401);
    }

    public function test_me_returns_user_with_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/me')
            ->assertStatus(200)
            ->assertJsonPath('data.email', $user->email);
    }
}
```

- [ ] **Step 2: Run, verifikasi GAGAL**

Run: `cd backend && php artisan test --filter=AuthApiTest`
Expected: FAIL (route 404 / 401 semua).

- [ ] **Step 3: Install Sanctum + migrasi token**

Run:
```bash
cd backend
php artisan install:api --no-interaction 2>&1 | tail -10
```
Expected: Sanctum terpasang, migrasi token dibuat. Baca output — pastikan tidak ada `error`.

- [ ] **Step 4: Request validation**

```php
<?php
// backend/app/Http/Requests/RegisterRequest.php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }
}
```

- [ ] **Step 5: Controller**

```php
<?php
// backend/app/Http/Controllers/Api/AuthController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    private function envelope(array $data, int $status = 200)
    {
        return response()->json([
            'success' => $status < 400,
            'data'    => $data,
            'meta'    => new \stdClass(),
        ], $status);
    }

    public function register(RegisterRequest $r)
    {
        $user = User::create([
            'name'     => $r->name,
            'email'    => $r->email,
            'password' => Hash::make($r->password),
        ]);
        Workspace::create(['owner_id' => $user->id, 'name' => "{$user->name} Workspace"]);
        $token = $user->createToken('api')->plainTextToken;

        return $this->envelope(['user' => $user, 'token' => $token], 201);
    }

    public function login(Request $r)
    {
        $r->validate(['email' => ['required','email'], 'password' => ['required','string']]);
        $user = User::where('email', $r->email)->first();
        if (!$user || !Hash::check($r->password, $user->password)) {
            return response()->json([
                'success' => false,
                'error'   => ['code' => 'INVALID_CREDENTIALS', 'message' => 'Email atau password salah'],
                'meta'    => new \stdClass(),
            ], 422);
        }
        return $this->envelope(['user' => $user, 'token' => $user->createToken('api')->plainTextToken]);
    }

    public function me(Request $r)
    {
        return $this->envelope(['user' => $r->user()]);
    }
}
```

```php
// tambahkan di backend/routes/api.php
use App\Http\Controllers\Api\AuthController;
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->get('/me', [AuthController::class, 'me']);
```

- [ ] **Step 6: Run, verifikasi PASS**

Run: `cd backend && php artisan test --filter=AuthApiTest`
Expected: PASS (6 test).

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(backend): add auth api (register/login/me) with sanctum"
```

---

### Task 6: Gerbang Milestone 1 — semua test + local-ci hijau

**Files:**
- Modify: `scripts/local-ci.sh` (tambahkan gate `php` yang menjalankan `php artisan test`)

**Interfaces:**
- Consumes: seluruh task di atas.
- Produces: `local-ci.sh` menjalankan test Laravel; Milestone 1 dinyatakan selesai dengan bukti.

- [ ] **Step 1: Cek apakah `local-ci.sh` sudah punya gate php**

Run: `grep -n "php" scripts/local-ci.sh | head`
Expected: kalau kosong → tambahkan blok berikut sebelum bagian SUMMARY.

- [ ] **Step 2: Tambahkan gate php**

```bash
# --- php (Laravel core) ---
if [ -f backend/composer.json ]; then
  echo "--- php ---"
  if (cd backend && php artisan test --no-interaction >/tmp/formforge-php-test.log 2>&1); then
    echo "ok    php:test"
  else
    echo "FAIL  php:test"; tail -30 /tmp/formforge-php-test.log; fail=1
  fi
fi
```

- [ ] **Step 3: Jalankan gate penuh + verifikasi**

Run:
```bash
docker compose up -d && bash scripts/wait-for-db.sh
bash scripts/local-ci.sh --tier t0 --fast
```
Expected: `LOCAL-CI: ALL GREEN` (secrets + php:test ok).

- [ ] **Step 4: Mutation check gate (SOP: gate yang nggak bisa gagal itu dekorasi)**

Rusak sementara satu test (`$this->assertTrue(false);`), jalankan `local-ci.sh --fast` → **harus exit 1**. Kembalikan → hijau.

- [ ] **Step 5: Commit**

```bash
git add scripts/local-ci.sh
git commit -m "ci: wire laravel test gate into local-ci"
```

---

## Definition of Done — Milestone 1

- [ ] `docker compose up -d` → Postgres 18 + Redis 7 `healthy`
- [ ] `GET /api/health` → `{db:"ok", cache:"ok"}`
- [ ] `FormSchema` lulus 8 unit test + mutation check
- [ ] `Workspace` lulus 3 test (UUID, relasi owner)
- [ ] Auth API lulus 6 test (register + workspace default, login, me, jalur gagal)
- [ ] `local-ci.sh --tier t0 --fast` → ALL GREEN, dan terbukti **bisa merah**
- [ ] Semua commit conventional, tidak ada secret ter-commit

## Batas Plan 1 (dicatat eksplisit, bukan gap diam-diam)

Plan 1 menghasilkan **kontrak** skema form (`FormSchema` value object) tetapi
**belum** membuat tabel `form_versions.schema jsonb`. Kolom JSONB itu mendarat di
**Plan 3 (Publish & Render)** bersama tabel `forms` dan `form_versions`, karena
kolom itu baru punya arti begitu ada alur publish + versioning (keputusan D1/D4).
Membuatnya sekarang = tabel tanpa konsumen.

## Plan berikutnya (belum ditulis — ditulis saat milestone itu dimulai)

- **Plan 2** — Builder UI (Next.js drag-drop + reducer builder TDD)
- **Plan 3** — Publish & Render (Go edge + Next public page + submit)
- **Plan 4** — Responses view + export CSV
- **Plan 5** — Conditional logic
- **Plan 6** — Analytics (events → rollup → funnel + dropout per-field)
- **Plan 7** — Partial submission autosave + file upload
- **Plan 8** — Hardening (rate limit, honeypot) + packaging (README, demo, ADR)
