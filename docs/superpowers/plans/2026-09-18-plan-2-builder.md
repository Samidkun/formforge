# FormForge — Plan 2: Builder UI (Milestone 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun builder form: app Next.js di `frontend/` (field palette + canvas drag-drop + config panel, semua 9 field type) dengan **schema reducer sebagai pure logic yang di-TDD**, plus tabel `forms` + CRUD API di Laravel supaya draft benar-benar tersimpan dan bisa diuji end-to-end.

**Architecture:** Builder = **pure reducer** (`frontend/src/builder/schema.ts`) yang memanipulasi `Schema` (`{fields: [...]}`) tanpa React — diuji vitest tanpa DOM. UI (palette/canvas/config panel) hanyalah render dari state reducer + dispatch. Persistensi draft lewat `PATCH /api/forms/{id}` ke Laravel, yang memvalidasi `draft_schema` memakai **value object `FormSchema` dari Plan 1** (bukan validasi tulis-ulang). Ownership draft ditegakkan Laravel Policy.

**Tech Stack:** Next.js 16.3.5, React 19.3.0, TypeScript 5.9.3, Tailwind CSS 4.3.3 (CSS-first `@theme`), @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0, Vitest 5.0.1 + @testing-library/react 16.3.3 + jsdom 30.1.0, ESLint 9.39.5 + eslint-config-next 16.3.5, Playwright 1.63.0 (1 smoke test). Backend: Laravel 12 + Postgres 18 (sudah ada dari Plan 1).

**Spec:** `docs/superpowers/specs/2026-09-17-formforge-design.md`

**Plan sebelumnya:** `docs/superpowers/plans/2026-09-17-plan-1-foundation.md` (T1–T6 CLOSED; 33 test hijau; gate `scripts/local-ci.sh` terbukti bisa merah).

## Global Constraints

- **Tier:** T0 — Personal. Docs/E2E/UAT opsional; **TDD untuk logika nyata wajib**.
- **IRON LAW:** tidak ada production code tanpa test yang gagal lebih dulu.
- **Envelope API seragam:** `{success, data|error, meta}` — termasuk 401/403/422 (handler sudah ada di `backend/bootstrap/app.php` sejak T5/T6; JANGAN bikin handler baru).
- **Field type (9, dari `App\Domain\FieldType`):** `text, email, number, long_text, choice, multi_choice, rating, date, file`.
- **Field key berformat `f_<n>`** (`f_1`, `f_2`, …) — konsisten dengan spec §4 D4.
- **Schema shape:** `{"fields":[{"key","type","label","required"?,"options"?}]}` — **hanya** ini; jangan tambah kunci di luar kontrak Plan 1 (validasi `FormSchema` akan menolaknya).
- **Design token = warisan Rukun (spec §6), bukan sistem baru.** Nilai verbatim ada di Task 3.
- **Determinisme versi:** semua dependency di-pin **eksak** (tanpa `^`). TypeScript di-pin **5.9.3**, bukan 7.0.2 (TS 7 = port native Go, ekosistem belum matang — risiko tooling untuk project portofolio; dicatat sebagai ruling P2-2).
- **`frontend/package-lock.json` WAJIB di-commit** — tanpa lockfile gate `node:audit` gagal by design (Plan 1 T6-4).
- **`frontend/` TIDAK boleh punya `composer.json`** — deteksi node monorepo-aware (T6-4) men-skip dir yang punya `composer.json` (dianggap pipeline Vite milik app PHP).
- **Port dev:** Next.js `3000`; Laravel `8000` (dipakai hanya sebagai API saat dev).
- **Tidak ada secret plaintext.** `.env` di-gitignore; `.env.example` di-commit.
- **Commit kecil & conventional**, satu concern per commit.
- **Setiap task berakhir dengan test hijau + commit.**

---

### Task 1: Tabel `forms` + model + generator slug (Laravel)

**Files:**
- Create: `backend/database/migrations/2026_09_18_000001_create_forms_table.php`
- Create: `backend/app/Models/Form.php`
- Create: `backend/app/Domain/FormSlug.php`
- Modify: `backend/app/Models/Workspace.php` (tambah relasi `forms()`)
- Test: `backend/tests/Unit/FormSlugTest.php`
- Test: `backend/tests/Feature/FormModelTest.php`

**Interfaces:**
- Consumes: `workspaces` (Plan 1, `id` = **uuid**), `App\Domain\FormSchema` (Plan 1).
- Produces:
  - `App\Models\Form` dengan `$fillable = ['workspace_id','title','slug','status','draft_schema','settings']`, cast `draft_schema`/`settings` → `array`, relasi `workspace(): BelongsTo`.
  - `App\Models\Workspace::forms(): HasMany`.
  - `App\Domain\FormSlug::base(string $title): string` dan `FormSlug::resolve(string $title, callable $taken): string`.

- [x] **Step 1: Tulis test slug yang gagal**

```php
<?php
// backend/tests/Unit/FormSlugTest.php
namespace Tests\Unit;

use App\Domain\FormSlug;
use PHPUnit\Framework\TestCase;

class FormSlugTest extends TestCase
{
    public function test_base_slugifies_title(): void
    {
        $this->assertSame('form-pendaftaran-2026', FormSlug::base('Form Pendaftaran 2026'));
    }

    public function test_base_strips_punctuation_and_collapses_separators(): void
    {
        $this->assertSame('halo-dunia', FormSlug::base('  Halo,   Dunia!!  '));
    }

    public function test_base_falls_back_when_title_has_no_usable_characters(): void
    {
        $this->assertSame('form', FormSlug::base('!!!'));
        $this->assertSame('form', FormSlug::base(''));
    }

    public function test_base_truncates_to_60_characters(): void
    {
        $this->assertSame(60, strlen(FormSlug::base(str_repeat('a', 200))));
    }

    public function test_resolve_returns_base_when_free(): void
    {
        $this->assertSame('toko-a', FormSlug::resolve('Toko A', fn ($s) => false));
    }

    public function test_resolve_appends_incrementing_suffix_when_taken(): void
    {
        $taken = ['toko-a', 'toko-a-2'];
        $this->assertSame('toko-a-3', FormSlug::resolve('Toko A', fn ($s) => in_array($s, $taken, true)));
    }
}
```

- [x] **Step 2: Jalankan test, pastikan GAGAL**

Run: `cd backend && php artisan test --filter=FormSlugTest`
Expected: FAIL — `Class "App\Domain\FormSlug" not found`.

- [x] **Step 3: Implementasi `FormSlug`**

```php
<?php
// backend/app/Domain/FormSlug.php
namespace App\Domain;

final class FormSlug
{
    public static function base(string $title): string
    {
        $s = strtolower(trim($title));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
        $s = trim($s, '-');
        if ($s === '') {
            $s = 'form';
        }
        return substr($s, 0, 60);
    }

    /** @param callable(string): bool $taken */
    public static function resolve(string $title, callable $taken): string
    {
        $base = self::base($title);
        if (!$taken($base)) {
            return $base;
        }
        $n = 2;
        while ($taken($base . '-' . $n)) {
            $n++;
        }
        return $base . '-' . $n;
    }
}
```

- [x] **Step 4: Jalankan test, pastikan PASS**

Run: `cd backend && php artisan test --filter=FormSlugTest`
Expected: PASS (6 test).

- [x] **Step 5: Tulis test model yang gagal**

```php
<?php
// backend/tests/Feature/FormModelTest.php
namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FormModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_workspace_has_many_forms(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'WS']);
        Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);
        Form::create(['workspace_id' => $ws->id, 'title' => 'B', 'slug' => 'b']);

        $this->assertCount(2, $ws->fresh()->forms);
    }

    public function test_form_belongs_to_workspace(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'WS']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->assertTrue($form->workspace->is($ws));
    }

    public function test_form_id_is_uuid_and_status_defaults_to_draft(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'WS']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $form->id
        );
        $this->assertSame('draft', $form->fresh()->status);
    }

    public function test_draft_schema_is_cast_to_array(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'WS']);
        $form = Form::create([
            'workspace_id' => $ws->id,
            'title' => 'A',
            'slug' => 'a',
            'draft_schema' => ['fields' => [['key' => 'f_1', 'type' => 'text', 'label' => 'Nama']]],
        ]);

        $this->assertIsArray($form->fresh()->draft_schema);
        $this->assertSame('f_1', $form->fresh()->draft_schema['fields'][0]['key']);
    }

    public function test_slug_is_unique(): void
    {
        $user = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $user->id, 'name' => 'WS']);
        Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'sama']);

        $this->expectException(\Illuminate\Database\QueryException::class);
        Form::create(['workspace_id' => $ws->id, 'title' => 'B', 'slug' => 'sama']);
    }
}
```

- [x] **Step 6: Jalankan test, pastikan GAGAL**

Run: `cd backend && php artisan test --filter=FormModelTest`
Expected: FAIL — `relation "forms" does not exist` (migrasi & model belum ada).

- [x] **Step 7: Tulis migrasi**

```php
<?php
// backend/database/migrations/2026_09_18_000001_create_forms_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('forms', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            // NOTE: workspaces.id IS a uuid (HasUuids), so foreignUuid is correct
            // here. Contrast with workspaces.owner_id (Plan 1, ruling T4-1) which
            // had to be foreignId because users.id is the Laravel default bigint.
            $table->foreignUuid('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('status')->default('draft');   // draft|published|closed
            $table->jsonb('draft_schema')->default('{"fields":[]}');
            $table->jsonb('settings')->default('{}');
            $table->timestamps();
            $table->index('workspace_id');
        });
    }

    public function down(): void { Schema::dropIfExists('forms'); }
};
```

- [x] **Step 8: Tulis model `Form` + relasi di `Workspace`**

```php
<?php
// backend/app/Models/Form.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Form extends Model
{
    use HasUuids;

    protected $fillable = ['workspace_id', 'title', 'slug', 'status', 'draft_schema', 'settings'];

    protected $casts = [
        'draft_schema' => 'array',
        'settings'     => 'array',
    ];

    public function workspace(): BelongsTo { return $this->belongsTo(Workspace::class); }
}
```

Tambahkan ke `backend/app/Models/Workspace.php` (import `HasMany` di atas):

```php
    public function forms(): HasMany { return $this->hasMany(Form::class); }
```

- [x] **Step 9: Jalankan test, pastikan PASS**

Run: `cd backend && php artisan test --filter="FormSlugTest|FormModelTest"`
Expected: PASS (6 + 5 = 11 test).

- [x] **Step 10: Commit**

```bash
git add backend/database/migrations/2026_09_18_000001_create_forms_table.php \
        backend/app/Models/Form.php backend/app/Models/Workspace.php \
        backend/app/Domain/FormSlug.php \
        backend/tests/Unit/FormSlugTest.php backend/tests/Feature/FormModelTest.php
git commit -m "feat(backend): add forms table, Form model and slug generator"
```

---

### Task 2: CRUD API `forms` + Policy ownership

**Files:**
- Create: `backend/app/Http/Controllers/Api/FormController.php`
- Create: `backend/app/Http/Requests/StoreFormRequest.php`
- Create: `backend/app/Http/Requests/UpdateFormRequest.php`
- Create: `backend/app/Policies/FormPolicy.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/FormApiTest.php`

**Interfaces:**
- Consumes: `App\Models\Form`, `App\Models\Workspace` (Task 1); `App\Domain\FormSlug::resolve()` (Task 1); `App\Domain\FormSchema::fromArray()` (Plan 1); envelope handler di `bootstrap/app.php` (Plan 1 T5/T6).
- Produces (kontrak REST yang dipakai frontend di Task 6):
  - `GET /api/forms` → `200 {success:true, data:[Form...], meta:{}}` (urut `created_at` desc)
  - `POST /api/forms` body `{title}` → `201 {success:true, data:Form, meta:{}}`
  - `GET /api/forms/{id}` → `200 {success:true, data:Form, meta:{}}`
  - `PATCH /api/forms/{id}` body `{title?, draft_schema?}` → `200 {success:true, data:Form, meta:{}}`
  - `DELETE /api/forms/{id}` → `200 {success:true, data:{deleted:true}, meta:{}}`
  - Semua butuh `auth:sanctum`. Bukan pemilik → `403` envelope. Bukan milik siapa pun/tidak ada → `404`. `draft_schema` tidak valid → `422` envelope `error.code = INVALID_SCHEMA`.

- [x] **Step 1: Tulis test API yang gagal**

```php
<?php
// backend/tests/Feature/FormApiTest.php
namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FormApiTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsUser(): array
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;
        return [$user, ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json']];
    }

    public function test_index_requires_auth(): void
    {
        $this->getJson('/api/forms')
            ->assertStatus(401)
            ->assertJson(['success' => false]);
    }

    public function test_index_lists_only_my_workspace_forms(): void
    {
        [$me, $h] = $this->actingAsUser();
        $mine = Workspace::create(['owner_id' => $me->id, 'name' => 'Mine']);
        Form::create(['workspace_id' => $mine->id, 'title' => 'Punyaku', 'slug' => 'punyaku']);

        $other = User::factory()->create();
        $theirs = Workspace::create(['owner_id' => $other->id, 'name' => 'Theirs']);
        Form::create(['workspace_id' => $theirs->id, 'title' => 'PunyaOrang', 'slug' => 'punya-orang']);

        $res = $this->getJson('/api/forms', $h)->assertOk()->assertJson(['success' => true]);
        $this->assertCount(1, $res->json('data'));
        $this->assertSame('Punyaku', $res->json('data.0.title'));
    }

    public function test_store_creates_form_with_unique_slug(): void
    {
        [$me, $h] = $this->actingAsUser();
        Workspace::create(['owner_id' => $me->id, 'name' => 'WS']);

        $this->postJson('/api/forms', ['title' => 'Toko A'], $h)
            ->assertStatus(201)
            ->assertJson(['success' => true, 'data' => ['title' => 'Toko A', 'slug' => 'toko-a', 'status' => 'draft']]);

        $this->postJson('/api/forms', ['title' => 'Toko A'], $h)
            ->assertStatus(201)
            ->assertJson(['data' => ['slug' => 'toko-a-2']]);
    }

    public function test_store_requires_a_workspace(): void
    {
        [, $h] = $this->actingAsUser();   // sengaja tanpa workspace

        $this->postJson('/api/forms', ['title' => 'X'], $h)
            ->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_store_validates_title(): void
    {
        [$me, $h] = $this->actingAsUser();
        Workspace::create(['owner_id' => $me->id, 'name' => 'WS']);

        $this->postJson('/api/forms', ['title' => ''], $h)
            ->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_show_returns_my_form(): void
    {
        [$me, $h] = $this->actingAsUser();
        $ws = Workspace::create(['owner_id' => $me->id, 'name' => 'WS']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->getJson("/api/forms/{$form->id}", $h)
            ->assertOk()
            ->assertJson(['success' => true, 'data' => ['id' => $form->id]]);
    }

    public function test_show_forbidden_for_other_users_form(): void
    {
        [, $h] = $this->actingAsUser();
        $other = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $other->id, 'name' => 'Theirs']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->getJson("/api/forms/{$form->id}", $h)
            ->assertStatus(403)
            ->assertJson(['success' => false, 'error' => ['code' => 'FORBIDDEN']]);
    }

    public function test_show_404_for_unknown_form(): void
    {
        [, $h] = $this->actingAsUser();
        $this->getJson('/api/forms/' . (string) \Illuminate\Support\Str::uuid(), $h)
            ->assertStatus(404);
    }

    public function test_update_saves_valid_draft_schema(): void
    {
        [$me, $h] = $this->actingAsUser();
        $ws = Workspace::create(['owner_id' => $me->id, 'name' => 'WS']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->patchJson("/api/forms/{$form->id}", [
            'title' => 'Judul Baru',
            'draft_schema' => ['fields' => [['key' => 'f_1', 'type' => 'email', 'label' => 'Email']]],
        ], $h)->assertOk()->assertJson([
            'success' => true,
            'data' => ['title' => 'Judul Baru'],
        ]);

        $this->assertSame('f_1', $form->fresh()->draft_schema['fields'][0]['key']);
    }

    public function test_update_rejects_invalid_draft_schema(): void
    {
        [$me, $h] = $this->actingAsUser();
        $ws = Workspace::create(['owner_id' => $me->id, 'name' => 'WS']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->patchJson("/api/forms/{$form->id}", [
            'draft_schema' => ['fields' => [['key' => 'f_1', 'type' => 'tidak_ada', 'label' => 'X']]],
        ], $h)->assertStatus(422)
            ->assertJson(['success' => false, 'error' => ['code' => 'INVALID_SCHEMA']]);

        // draft tidak berubah
        $this->assertSame([], $form->fresh()->draft_schema['fields']);
    }

    public function test_update_forbidden_for_other_users_form(): void
    {
        [, $h] = $this->actingAsUser();
        $other = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $other->id, 'name' => 'Theirs']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->patchJson("/api/forms/{$form->id}", ['title' => 'Hack'], $h)
            ->assertStatus(403)
            ->assertJson(['success' => false]);
    }

    public function test_destroy_deletes_my_form(): void
    {
        [$me, $h] = $this->actingAsUser();
        $ws = Workspace::create(['owner_id' => $me->id, 'name' => 'WS']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->deleteJson("/api/forms/{$form->id}", [], $h)
            ->assertOk()
            ->assertJson(['success' => true, 'data' => ['deleted' => true]]);

        $this->assertDatabaseMissing('forms', ['id' => $form->id]);
    }

    public function test_destroy_forbidden_for_other_users_form(): void
    {
        [, $h] = $this->actingAsUser();
        $other = User::factory()->create();
        $ws = Workspace::create(['owner_id' => $other->id, 'name' => 'Theirs']);
        $form = Form::create(['workspace_id' => $ws->id, 'title' => 'A', 'slug' => 'a']);

        $this->deleteJson("/api/forms/{$form->id}", [], $h)->assertStatus(403);
        $this->assertDatabaseHas('forms', ['id' => $form->id]);
    }
}
```

- [x] **Step 2: Jalankan test, pastikan GAGAL**

Run: `cd backend && php artisan test --filter=FormApiTest`
Expected: FAIL — semua 404 (route belum ada).

- [x] **Step 3: Tulis Policy**

```php
<?php
// backend/app/Policies/FormPolicy.php
namespace App\Policies;

use App\Models\Form;
use App\Models\User;

class FormPolicy
{
    private function owns(User $user, Form $form): bool
    {
        return (int) $form->workspace->owner_id === (int) $user->id;
    }

    public function view(User $user, Form $form): bool { return $this->owns($user, $form); }
    public function update(User $user, Form $form): bool { return $this->owns($user, $form); }
    public function delete(User $user, Form $form): bool { return $this->owns($user, $form); }
}
```

- [x] **Step 4: Tulis FormRequest**

```php
<?php
// backend/app/Http/Requests/StoreFormRequest.php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFormRequest extends FormRequest
{
    public function authorize(): bool { return true; }   // auth:sanctum di route

    public function rules(): array
    {
        return ['title' => ['required', 'string', 'max:255']];
    }
}
```

```php
<?php
// backend/app/Http/Requests/UpdateFormRequest.php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFormRequest extends FormRequest
{
    public function authorize(): bool { return true; }   // ownership via Policy

    public function rules(): array
    {
        return [
            'title'        => ['sometimes', 'string', 'max:255'],
            'draft_schema' => ['sometimes', 'array'],
        ];
    }
}
```

- [x] **Step 5: Tulis controller**

```php
<?php
// backend/app/Http/Controllers/Api/FormController.php
namespace App\Http\Controllers\Api;

use App\Domain\FormSchema;
use App\Domain\FormSlug;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFormRequest;
use App\Http\Requests\UpdateFormRequest;
use App\Models\Form;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FormController extends Controller
{
    private function envelope(array $data, int $status = 200)
    {
        return response()->json([
            'success' => $status < 400,
            'data'    => $data,
            'meta'    => new \stdClass(),
        ], $status);
    }

    private function error(string $code, string $message, int $status)
    {
        return response()->json([
            'success' => false,
            'error'   => ['code' => $code, 'message' => $message],
            'meta'    => new \stdClass(),
        ], $status);
    }

    public function index(Request $r)
    {
        $forms = Form::whereIn(
            'workspace_id',
            Workspace::where('owner_id', $r->user()->id)->pluck('id')
        )->orderByDesc('created_at')->orderByDesc('id')->get();

        return $this->envelope($forms->toArray());
    }

    public function store(StoreFormRequest $r)
    {
        $workspace = Workspace::where('owner_id', $r->user()->id)
            ->orderBy('created_at')->orderBy('id')->first();

        if (!$workspace) {
            return $this->error('NO_WORKSPACE', 'User tidak punya workspace.', 422);
        }

        $slug = FormSlug::resolve($r->title, fn ($s) => Form::where('slug', $s)->exists());

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title'        => $r->title,
            'slug'         => $slug,
        ]);

        return $this->envelope($form->toArray(), 201);
    }

    public function show(Form $form)
    {
        Gate::authorize('view', $form);
        return $this->envelope($form->toArray());
    }

    public function update(UpdateFormRequest $r, Form $form)
    {
        Gate::authorize('update', $form);

        // draft_schema divalidasi oleh value object Plan 1 — bukan validasi tulis-ulang.
        if ($r->has('draft_schema')) {
            try {
                $schema = FormSchema::fromArray($r->input('draft_schema'));
            } catch (\InvalidArgumentException $e) {
                return $this->error('INVALID_SCHEMA', $e->getMessage(), 422);
            }
            $form->draft_schema = $schema->toArray();
        }

        if ($r->filled('title')) {
            $form->title = $r->title;
        }

        $form->save();

        return $this->envelope($form->fresh()->toArray());
    }

    public function destroy(Form $form)
    {
        Gate::authorize('delete', $form);
        $form->delete();
        return $this->envelope(['deleted' => true]);
    }
}
```

- [x] **Step 6: Daftarkan route**

Tambahkan ke `backend/routes/api.php` (import di atas: `use App\Http\Controllers\Api\FormController;`):

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/forms', [FormController::class, 'index']);
    Route::post('/forms', [FormController::class, 'store']);
    Route::get('/forms/{form}', [FormController::class, 'show']);
    Route::patch('/forms/{form}', [FormController::class, 'update']);
    Route::delete('/forms/{form}', [FormController::class, 'destroy']);
});
```

Hapus baris `Route::middleware('auth:sanctum')->get('/me', ...)` yang lama (sudah pindah ke dalam group).

- [x] **Step 7: Jalankan test, pastikan PASS**

Run: `cd backend && php artisan test --filter=FormApiTest`
Expected: PASS (13 test).

- [x] **Step 8: Jalankan seluruh suite backend (regresi Plan 1)**

Run: `cd backend && php artisan test`
Expected: PASS — 33 test lama + 11 (Task 1) + 13 (Task 2) = **57 test**.

- [x] **Step 9: Commit**

```bash
git add backend/app/Http/Controllers/Api/FormController.php \
        backend/app/Http/Requests/StoreFormRequest.php \
        backend/app/Http/Requests/UpdateFormRequest.php \
        backend/app/Policies/FormPolicy.php backend/routes/api.php \
        backend/tests/Feature/FormApiTest.php
git commit -m "feat(backend): add forms CRUD api with ownership policy"
```

---

### Task 3: Scaffold `frontend/` (Next.js) + design token Rukun + field palette

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.ts`
- Create: `frontend/postcss.config.mjs`, `frontend/eslint.config.mjs`, `frontend/vitest.config.ts`
- Create: `frontend/src/app/globals.css` (token Rukun), `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`
- Create: `frontend/src/app/forms/[id]/edit/page.tsx`
- Create: `frontend/src/builder/types.ts`, `frontend/src/builder/fieldTypes.ts`
- Create: `frontend/src/builder/components/FieldPalette.tsx`
- Create: `frontend/src/builder/components/FieldPalette.test.tsx`
- Create: `frontend/.env.example`
- Create: `frontend/.gitignore`

**Interfaces:**
- Consumes: `FieldType` (9 nilai) dari spec/Plan 1.
- Produces:
  - `frontend/src/builder/types.ts` → `type FieldType = 'text'|'email'|'number'|'long_text'|'choice'|'multi_choice'|'rating'|'date'|'file'`, `type Field = {key, type, label, required?, options?}`, `type Schema = {fields: Field[]}`.
  - `frontend/src/builder/fieldTypes.ts` → `FIELD_TYPES: readonly FieldType[]` (9, urut) dan `FIELD_LABELS: Record<FieldType, string>`.
  - `FieldPalette` component: `{ onAdd(type: FieldType): void }` — 9 tombol, tiap tombol `aria-label="Tambah field {label}"`.

- [x] **Step 1: Scaffold app + pin dependency eksak**

Buat `frontend/package.json` (SEMUA versi eksak — tanpa `^`; alasan: determinisme, Plan 1 ruling T2-1):

```json
{
  "name": "formforge-builder",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "16.3.5",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "@dnd-kit/core": "6.3.1",
    "@dnd-kit/sortable": "10.0.0"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "@types/node": "22.10.2",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "tailwindcss": "4.3.3",
    "@tailwindcss/postcss": "4.3.3",
    "eslint": "9.39.5",
    "eslint-config-next": "16.3.5",
    "vitest": "5.0.1",
    "@vitejs/plugin-react": "6.1.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/user-event": "14.6.1",
    "jsdom": "30.1.0"
  }
}
```

> **CATATAN determinisme (ruling P2-2):** TypeScript di-pin **5.9.3** (bukan 7.0.2). TS 7 adalah port compiler ke Go; ekosistem plugin/lint belum sepenuhnya pindah, dan project portofolio tidak boleh menukar stabilitas tooling demi nomor versi tertinggi. Bila `npm install` mengeluh peer-dep, turunkan `@types/node` ke versi 22 terbaru yang cocok — jangan naikkan TypeScript.

- [x] **Step 2: Install + commit lockfile**

Run:
```bash
cd frontend && npm install
test -f package-lock.json && echo "LOCKFILE OK"
```
Expected: `LOCKFILE OK`. Lockfile **wajib** di-commit (gate `node:audit` gagal tanpa itu).

- [x] **Step 3: Config files**

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`frontend/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' }];
  },
};
export default nextConfig;
```

`frontend/postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`frontend/eslint.config.mjs`:
```js
import next from 'eslint-config-next';
export default [...next.coreWebVitals];
```

`frontend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

`frontend/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [x] **Step 4: Design token Rukun (spec §6, nilai verbatim) + layout**

`frontend/src/app/globals.css`:
```css
@import "tailwindcss";

/* Design token — DIWARISI dari Rukun (spec §6), bukan sistem paralel. */
@theme {
  --color-bg-primary: #16181C;
  --color-surface-primary: #1E2228;
  --color-surface-elevated: #252A32;
  --color-border-hairline: #2A2E35;
  --color-accent-primary: #C7F53B;
  --color-accent-success: #4EE5B6;
  --color-accent-warning: #F5A623;
  --color-accent-danger: #FF4D4D;
  --color-text-primary: #F4F5F6;
  --color-text-secondary: #9DA5B4;
  --color-text-muted: #5A6270;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

body {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

`frontend/src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'FormForge Builder' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
```

`frontend/src/app/page.tsx` (empty state wajib — spec §6 "happy-path-only = defect"):
```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-semibold">FormForge</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Belum ada form yang dipilih.
      </p>
      <Link
        href="/forms/new/edit"
        className="mt-6 inline-block rounded bg-[var(--color-accent-primary)] px-4 py-2 font-medium text-[var(--color-bg-primary)]"
      >
        Buat form
      </Link>
    </main>
  );
}
```

- [x] **Step 5: Tulis tipe + daftar field type (pure data)**

`frontend/src/builder/types.ts`:
```ts
export type FieldType =
  | 'text' | 'email' | 'number' | 'long_text' | 'choice'
  | 'multi_choice' | 'rating' | 'date' | 'file';

export type Field = {
  key: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
};

export type Schema = { fields: Field[] };
```

`frontend/src/builder/fieldTypes.ts`:
```ts
import type { FieldType } from './types';

/** Urut sesuai spec §2.3 (9 field type) — dipakai palette & config panel. */
export const FIELD_TYPES = [
  'text', 'email', 'number', 'long_text', 'choice',
  'multi_choice', 'rating', 'date', 'file',
] as const satisfies readonly FieldType[];

export const FIELD_LABELS: Record<FieldType, string> = {
  text: 'Teks Singkat',
  email: 'Email',
  number: 'Angka',
  long_text: 'Teks Panjang',
  choice: 'Pilihan Tunggal',
  multi_choice: 'Pilihan Ganda',
  rating: 'Rating',
  date: 'Tanggal',
  file: 'Unggah Berkas',
};
```

- [x] **Step 6: Tulis test palette yang gagal**

```tsx
// frontend/src/builder/components/FieldPalette.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldPalette } from './FieldPalette';
import { FIELD_TYPES, FIELD_LABELS } from '../fieldTypes';

describe('FieldPalette', () => {
  it('menampilkan satu tombol untuk setiap 9 field type', () => {
    render(<FieldPalette onAdd={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('label tiap tombol memakai nama manusiawi dari FIELD_LABELS', () => {
    render(<FieldPalette onAdd={() => {}} />);
    for (const t of FIELD_TYPES) {
      expect(screen.getByRole('button', { name: `Tambah field ${FIELD_LABELS[t]}` })).toBeInTheDocument();
    }
  });

  it('memanggil onAdd dengan tipe yang benar saat diklik', async () => {
    const onAdd = vi.fn();
    render(<FieldPalette onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tambah field Email' }));
    expect(onAdd).toHaveBeenCalledWith('email');
  });
});
```

- [x] **Step 7: Jalankan test, pastikan GAGAL**

Run: `cd frontend && npm test`
Expected: FAIL — `Failed to resolve import "./FieldPalette"`.

- [x] **Step 8: Implementasi `FieldPalette`**

```tsx
// frontend/src/builder/components/FieldPalette.tsx
import { FIELD_TYPES, FIELD_LABELS } from '../fieldTypes';
import type { FieldType } from '../types';

export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <aside
      aria-label="Palet field"
      className="w-56 shrink-0 border-r border-[var(--color-border-hairline)] p-3"
    >
      <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        Field
      </h2>
      <ul className="flex flex-col gap-1">
        {FIELD_TYPES.map((t) => (
          <li key={t}>
            <button
              type="button"
              aria-label={`Tambah field ${FIELD_LABELS[t]}`}
              onClick={() => onAdd(t)}
              className="w-full rounded px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-primary)]"
            >
              {FIELD_LABELS[t]}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [x] **Step 9: Halaman builder (shell) + `GET /forms/new/edit`**

`frontend/src/app/forms/[id]/edit/page.tsx`:
```tsx
import { FieldPalette } from '@/builder/components/FieldPalette';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2">
        <span className="text-sm text-[var(--color-text-secondary)]">
          Form <span className="num">{id}</span>
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Task 5 mengganti placeholder ini dengan BuilderCanvas. */}
        <FieldPalette onAdd={() => {}} />
        <section className="flex-1 p-6 text-[var(--color-text-muted)]">
          Kanvas kosong — tambahkan field dari palet.
        </section>
      </div>
    </main>
  );
}
```

- [x] **Step 10: `.env.example` + `.gitignore`, lalu lint/typecheck/test**

`frontend/.env.example`:
```bash
# Base URL Laravel core untuk dev (rewrite /api/* di next.config.ts menunjuk ke sini).
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

`frontend/.gitignore`:
```
node_modules/
.next/
out/
coverage/
.env
.env.local
next-env.d.ts
```

Run:
```bash
cd frontend && npx tsc --noEmit && npm run lint && npm test
```
Expected: typecheck bersih, lint bersih, 3 test PASS.

- [x] **Step 11: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold next.js builder with rukun design tokens and field palette"
```

---

### Task 4: Schema reducer — pure logic builder (TDD, inti)

**Files:**
- Create: `frontend/src/builder/schema.ts`
- Test: `frontend/src/builder/schema.test.ts`

**Interfaces:**
- Consumes: `Schema`, `Field`, `FieldType` (Task 3).
- Produces (dipakai Task 5 & 6 — **nama & signature HARUS persis**):
  - `type SchemaAction = {type:'add_field', fieldType:FieldType} | {type:'remove_field', key:string} | {type:'move_field', key:string, toIndex:number} | {type:'update_field', key:string, patch:Partial<Pick<Field,'label'|'required'>>} | {type:'set_options', key:string, options:string[]} | {type:'replace', schema:Schema}`
  - `emptySchema(): Schema`
  - `nextFieldKey(schema: Schema): string` → `f_<n>` (n = 1 + jumlah key `f_<angka>` yang sudah ada, unik)
  - `schemaReducer(state: Schema, action: SchemaAction): Schema` (immutable)
  - `addField(schema, type): Schema` (helper, `key` = `nextFieldKey`, `label` = `FIELD_LABELS[type]`)
  - `canAddField(schema): boolean` (batas 50 field)
  - `MAX_FIELDS = 50`

- [x] **Step 1: Tulis test reducer yang gagal (LENGKAP — ini spesifikasi perilakunya)**

```ts
// frontend/src/builder/schema.test.ts
import { describe, it, expect } from 'vitest';
import {
  schemaReducer, emptySchema, nextFieldKey, addField, canAddField, MAX_FIELDS,
} from './schema';
import type { Schema } from './types';

const withFields = (n: number): Schema => ({
  fields: Array.from({ length: n }, (_, i) => ({
    key: `f_${i + 1}`, type: 'text' as const, label: `F${i + 1}`,
  })),
});

describe('emptySchema', () => {
  it('mulai dari nol field', () => {
    expect(emptySchema()).toEqual({ fields: [] });
  });
});

describe('nextFieldKey', () => {
  it('memberi f_1 pada schema kosong', () => {
    expect(nextFieldKey(emptySchema())).toBe('f_1');
  });

  it('melanjutkan dari nomor tertinggi, bukan dari panjang array', () => {
    // f_2 dihapus → panjang 1, tapi nomor tertinggi tetap 3 → berikutnya f_4
    const s: Schema = { fields: [
      { key: 'f_1', type: 'text', label: 'A' },
      { key: 'f_3', type: 'text', label: 'C' },
    ] };
    expect(nextFieldKey(s)).toBe('f_4');
  });

  it('tidak menabrak key non-standar', () => {
    const s: Schema = { fields: [{ key: 'f_9', type: 'text', label: 'X' }] };
    expect(nextFieldKey(s)).toBe('f_10');
  });
});

describe('addField', () => {
  it('menambahkan field dengan key dan label default dari tipe', () => {
    const s = addField(emptySchema(), 'email');
    expect(s.fields).toHaveLength(1);
    expect(s.fields[0].key).toBe('f_1');
    expect(s.fields[0].type).toBe('email');
    expect(s.fields[0].label).toBe('Email');
  });

  it('tidak memutasi schema lama (immutable)', () => {
    const before = emptySchema();
    const after = addField(before, 'text');
    expect(before.fields).toHaveLength(0);
    expect(after).not.toBe(before);
  });
});

describe('canAddField', () => {
  it('true di bawah batas', () => {
    expect(canAddField(withFields(MAX_FIELDS - 1))).toBe(true);
  });
  it('false tepat di batas', () => {
    expect(canAddField(withFields(MAX_FIELDS))).toBe(false);
  });
});

describe('schemaReducer — add_field', () => {
  it('menambah field baru di akhir', () => {
    const s = schemaReducer(withFields(1), { type: 'add_field', fieldType: 'rating' });
    expect(s.fields).toHaveLength(2);
    expect(s.fields[1]).toMatchObject({ key: 'f_2', type: 'rating', label: 'Rating' });
  });

  it('menolak menambah melewati MAX_FIELDS', () => {
    const full = withFields(MAX_FIELDS);
    const s = schemaReducer(full, { type: 'add_field', fieldType: 'text' });
    expect(s.fields).toHaveLength(MAX_FIELDS);
    expect(s).toBe(full); // tidak berubah sama sekali
  });
});

describe('schemaReducer — remove_field', () => {
  it('membuang field berdasarkan key', () => {
    const s = schemaReducer(withFields(3), { type: 'remove_field', key: 'f_2' });
    expect(s.fields.map((f) => f.key)).toEqual(['f_1', 'f_3']);
  });

  it('key yang tidak ada = no-op yang tetap immutable', () => {
    const before = withFields(2);
    const s = schemaReducer(before, { type: 'remove_field', key: 'tidak_ada' });
    expect(s.fields).toEqual(before.fields);
    expect(s).not.toBe(before);
  });
});

describe('schemaReducer — move_field', () => {
  it('memindahkan field ke indeks tujuan', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_1', toIndex: 2 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_2', 'f_3', 'f_1']);
  });

  it('memindahkan ke atas', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_3', toIndex: 0 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_3', 'f_1', 'f_2']);
  });

  it('toIndex di luar batas dijepit ke dalam rentang', () => {
    const s = schemaReducer(withFields(3), { type: 'move_field', key: 'f_1', toIndex: 99 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_2', 'f_3', 'f_1']);
  });

  it('key tidak dikenal = no-op', () => {
    const before = withFields(2);
    const s = schemaReducer(before, { type: 'move_field', key: 'x', toIndex: 0 });
    expect(s.fields.map((f) => f.key)).toEqual(['f_1', 'f_2']);
  });
});

describe('schemaReducer — update_field', () => {
  it('mengubah label', () => {
    const s = schemaReducer(withFields(1), { type: 'update_field', key: 'f_1', patch: { label: 'Nama Lengkap' } });
    expect(s.fields[0].label).toBe('Nama Lengkap');
  });

  it('mengubah required tanpa menyentuh field lain', () => {
    const s = schemaReducer(withFields(2), { type: 'update_field', key: 'f_2', patch: { required: true } });
    expect(s.fields[0].required).toBeUndefined();
    expect(s.fields[1].required).toBe(true);
  });

  it('tidak bisa mengubah key atau type lewat patch', () => {
    const s = schemaReducer(withFields(1), {
      type: 'update_field', key: 'f_1',
      patch: { key: 'hacked', type: 'file' } as never,
    });
    expect(s.fields[0].key).toBe('f_1');
    expect(s.fields[0].type).toBe('text');
  });
});

describe('schemaReducer — set_options', () => {
  it('menyimpan opsi untuk field pilihan', () => {
    const s = schemaReducer(withFields(1), { type: 'set_options', key: 'f_1', options: ['A', 'B'] });
    expect(s.fields[0].options).toEqual(['A', 'B']);
  });

  it('membuang opsi kosong/whitespace dan mempertahankan urutan', () => {
    const s = schemaReducer(withFields(1), { type: 'set_options', key: 'f_1', options: [' A ', '', '   ', 'B'] });
    expect(s.fields[0].options).toEqual(['A', 'B']);
  });
});

describe('schemaReducer — replace', () => {
  it('mengganti seluruh schema (dipakai saat memuat draft dari API)', () => {
    const loaded: Schema = { fields: [{ key: 'f_1', type: 'date', label: 'Tanggal' }] };
    const s = schemaReducer(withFields(5), { type: 'replace', schema: loaded });
    expect(s).toEqual(loaded);
  });
});

describe('schemaReducer — immutability menyeluruh', () => {
  it('setiap aksi mengembalikan objek baru dan tidak mengubah input', () => {
    const before = withFields(3);
    const snapshot = JSON.stringify(before);
    const actions = [
      { type: 'add_field', fieldType: 'text' },
      { type: 'remove_field', key: 'f_2' },
      { type: 'move_field', key: 'f_1', toIndex: 2 },
      { type: 'update_field', key: 'f_1', patch: { label: 'X' } },
      { type: 'set_options', key: 'f_1', options: ['Z'] },
    ] as const;
    for (const a of actions) {
      const out = schemaReducer(before, a as never);
      expect(out).not.toBe(before);
      expect(JSON.stringify(before)).toBe(snapshot);
    }
  });
});
```

- [x] **Step 2: Jalankan test, pastikan GAGAL**

Run: `cd frontend && npx vitest run src/builder/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema"`.

- [x] **Step 3: Implementasi reducer**

```ts
// frontend/src/builder/schema.ts
import { FIELD_LABELS } from './fieldTypes';
import type { Field, FieldType, Schema } from './types';

export const MAX_FIELDS = 50;

export type SchemaAction =
  | { type: 'add_field'; fieldType: FieldType }
  | { type: 'remove_field'; key: string }
  | { type: 'move_field'; key: string; toIndex: number }
  | { type: 'update_field'; key: string; patch: Partial<Pick<Field, 'label' | 'required'>> }
  | { type: 'set_options'; key: string; options: string[] }
  | { type: 'replace'; schema: Schema };

export function emptySchema(): Schema {
  return { fields: [] };
}

/** f_<n> dengan n = 1 + nomor tertinggi yang sudah dipakai (tidak menabrak f_3 saat f_2 dihapus). */
export function nextFieldKey(schema: Schema): string {
  let max = 0;
  for (const f of schema.fields) {
    const m = /^f_(\d+)$/.exec(f.key);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `f_${max + 1}`;
}

export function canAddField(schema: Schema): boolean {
  return schema.fields.length < MAX_FIELDS;
}

export function addField(schema: Schema, type: FieldType): Schema {
  if (!canAddField(schema)) return schema;
  const field: Field = { key: nextFieldKey(schema), type, label: FIELD_LABELS[type] };
  return { fields: [...schema.fields, field] };
}

export function schemaReducer(state: Schema, action: SchemaAction): Schema {
  switch (action.type) {
    case 'add_field':
      return addField(state, action.fieldType);

    case 'remove_field':
      return { fields: state.fields.filter((f) => f.key !== action.key) };

    case 'move_field': {
      const from = state.fields.findIndex((f) => f.key === action.key);
      if (from === -1) return { fields: [...state.fields] };
      const fields = [...state.fields];
      const [moved] = fields.splice(from, 1);
      const to = Math.max(0, Math.min(action.toIndex, fields.length));
      fields.splice(to, 0, moved);
      return { fields };
    }

    case 'update_field':
      return {
        fields: state.fields.map((f) =>
          f.key === action.key
            // key & type TIDAK bisa diubah lewat patch — hanya label/required.
            ? { ...f, label: action.patch.label ?? f.label, required: action.patch.required ?? f.required }
            : f
        ),
      };

    case 'set_options':
      return {
        fields: state.fields.map((f) =>
          f.key === action.key
            ? { ...f, options: action.options.map((o) => o.trim()).filter((o) => o !== '') }
            : f
        ),
      };

    case 'replace':
      return { fields: [...action.schema.fields] };
  }
}
```

- [x] **Step 4: Jalankan test, pastikan PASS**

Run: `cd frontend && npx vitest run src/builder/schema.test.ts`
Expected: PASS — **24 test**.

- [x] **Step 5: Mutation check (SOP: gate yang tidak bisa gagal itu dekorasi)**

Rusak **satu** baris di `schema.ts`, jalankan test, pastikan MERAH, lalu kembalikan:

| Mutasi | Baris | Harapan |
|---|---|---|
| M1: `return `f_${max + 1}`` → `return `f_${schema.fields.length + 1}`` | `nextFieldKey` | MERAH (test "melanjutkan dari nomor tertinggi") |
| M2: `if (!canAddField(schema)) return schema;` dihapus | `addField` | MERAH (test "menolak menambah melewati MAX_FIELDS") |
| M3: `Math.min(action.toIndex, fields.length)` → `action.toIndex` | `move_field` | MERAH (test "dijepit ke rentang") |
| M4: `{ ...f, label: action.patch.label ?? f.label, ... }` → `{ ...f, ...action.patch }` | `update_field` | MERAH (test "tidak bisa mengubah key/type") |
| M5: `.filter((o) => o !== '')` dihapus | `set_options` | MERAH (test "membuang opsi kosong") |

Bukti: catat EXIT=1 + nama test yang gagal untuk tiap mutasi; restore; `md5sum` byte-identical.

- [x] **Step 6: Commit**

```bash
git add frontend/src/builder/schema.ts frontend/src/builder/schema.test.ts
git commit -m "feat(frontend): add builder schema reducer as pure tdd logic"
```

---

### Task 5: Canvas drag-drop (@dnd-kit/sortable) + Config Panel

**Files:**
- Create: `frontend/src/builder/components/SortableFieldItem.tsx`
- Create: `frontend/src/builder/components/BuilderCanvas.tsx`
- Create: `frontend/src/builder/components/FieldConfigPanel.tsx`
- Create: `frontend/src/builder/components/BuilderView.tsx`
- Test: `frontend/src/builder/components/FieldConfigPanel.test.tsx`
- Test: `frontend/src/builder/components/BuilderCanvas.test.tsx`
- Modify: `frontend/src/app/forms/[id]/edit/page.tsx`

**Interfaces:**
- Consumes:
  - `Schema, Field, FieldType` dari `src/builder/types.ts`
  - `FIELD_LABELS` dari `src/builder/fieldTypes.ts`
  - `schemaReducer, SchemaAction, emptySchema` dari `src/builder/schema.ts`
  - `FieldPalette` dari `src/builder/components/FieldPalette.tsx`
- Produces:
  - `BuilderCanvas`: Canvas interaktif dengan `@dnd-kit/sortable` untuk reorder field, selection highlight, dan remove action.
  - `FieldConfigPanel`: Panel inspeksi & edit atribut field terpilih (label, required toggle, opsi untuk choice/multi_choice).
  - `BuilderView`: Komponen koordinator menyatukan Palette + Canvas + ConfigPanel dengan state `useReducer(schemaReducer, initialSchema)`.

- [ ] **Step 1: Tulis test FieldConfigPanel yang gagal**

```tsx
// frontend/src/builder/components/FieldConfigPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldConfigPanel } from './FieldConfigPanel';
import type { Field } from '../types';

describe('FieldConfigPanel', () => {
  it('menampilkan placeholder saat tidak ada field yang dipilih', () => {
    render(<FieldConfigPanel selectedField={null} onUpdate={() => {}} onSetOptions={() => {}} />);
    expect(screen.getByText(/Pilih field di kanvas/i)).toBeInTheDocument();
  });

  it('menampilkan konfigurasi label dan required saat field dipilih', () => {
    const field: Field = { key: 'f_1', type: 'text', label: 'Nama Lengkap', required: true };
    render(<FieldConfigPanel selectedField={field} onUpdate={() => {}} onSetOptions={() => {}} />);

    expect(screen.getByDisplayValue('Nama Lengkap')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Wajib diisi/i })).toBeChecked();
  });

  it('memanggil onUpdate saat label diubah', async () => {
    const onUpdate = vi.fn();
    const field: Field = { key: 'f_1', type: 'text', label: 'Nama' };
    render(<FieldConfigPanel selectedField={field} onUpdate={onUpdate} onSetOptions={() => {}} />);

    const input = screen.getByLabelText(/Label Field/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'Email Kantor');

    expect(onUpdate).toHaveBeenCalledWith('f_1', { label: 'Email Kantor' });
  });

  it('menampilkan editor opsi HANYA untuk tipe choice atau multi_choice', () => {
    const textField: Field = { key: 'f_1', type: 'text', label: 'Nama' };
    const { rerender } = render(
      <FieldConfigPanel selectedField={textField} onUpdate={() => {}} onSetOptions={() => {}} />
    );
    expect(screen.queryByLabelText(/Opsi Pilihan/i)).not.toBeInTheDocument();

    const choiceField: Field = { key: 'f_2', type: 'choice', label: 'Paket', options: ['A', 'B'] };
    rerender(<FieldConfigPanel selectedField={choiceField} onUpdate={() => {}} onSetOptions={() => {}} />);
    expect(screen.getByLabelText(/Opsi Pilihan/i)).toBeInTheDocument();
  });

  it('memanggil onSetOptions saat opsi diubah', async () => {
    const onSetOptions = vi.fn();
    const choiceField: Field = { key: 'f_2', type: 'choice', label: 'Paket', options: ['A', 'B'] };
    render(<FieldConfigPanel selectedField={choiceField} onUpdate={() => {}} onSetOptions={onSetOptions} />);

    const textarea = screen.getByLabelText(/Opsi Pilihan/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Opsi 1\nOpsi 2\nOpsi 3');

    expect(onSetOptions).toHaveBeenCalledWith('f_2', ['Opsi 1', 'Opsi 2', 'Opsi 3']);
  });
});
```

- [ ] **Step 2: Jalankan test FieldConfigPanel, pastikan GAGAL**

Run: `cd frontend && npx vitest run src/builder/components/FieldConfigPanel.test.tsx`
Expected: FAIL — `Cannot find module './FieldConfigPanel'`.

- [ ] **Step 3: Implementasi FieldConfigPanel**

```tsx
// frontend/src/builder/components/FieldConfigPanel.tsx
import { FIELD_LABELS } from '../fieldTypes';
import type { Field } from '../types';

interface FieldConfigPanelProps {
  selectedField: Field | null;
  onUpdate: (key: string, patch: Partial<Pick<Field, 'label' | 'required'>>) => void;
  onSetOptions: (key: string, options: string[]) => void;
}

export function FieldConfigPanel({ selectedField, onUpdate, onSetOptions }: FieldConfigPanelProps) {
  if (!selectedField) {
    return (
      <aside
        aria-label="Panel Konfigurasi Field"
        className="w-72 shrink-0 border-l border-[var(--color-border-hairline)] p-4 text-sm text-[var(--color-text-muted)]"
      >
        <p>Pilih field di kanvas untuk mengedit properti.</p>
      </aside>
    );
  }

  const isChoiceType = selectedField.type === 'choice' || selectedField.type === 'multi_choice';

  return (
    <aside
      aria-label="Panel Konfigurasi Field"
      className="w-72 shrink-0 border-l border-[var(--color-border-hairline)] p-4 text-sm flex flex-col gap-4 overflow-y-auto"
    >
      <div>
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Tipe Field</span>
        <div className="mt-1 font-mono text-xs text-[var(--color-accent-primary)] bg-[var(--color-surface-primary)] px-2 py-1 rounded inline-block">
          {FIELD_LABELS[selectedField.type]} ({selectedField.type})
        </div>
      </div>

      <div>
        <label htmlFor="field-label-input" className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          Label Field
        </label>
        <input
          id="field-label-input"
          type="text"
          value={selectedField.label}
          onChange={(e) => onUpdate(selectedField.key, { label: e.target.value })}
          className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="field-required-toggle"
          type="checkbox"
          checked={Boolean(selectedField.required)}
          onChange={(e) => onUpdate(selectedField.key, { required: e.target.checked })}
          className="rounded border-[var(--color-border-hairline)] accent-[var(--color-accent-primary)]"
        />
        <label htmlFor="field-required-toggle" className="text-sm select-none text-[var(--color-text-primary)]">
          Wajib diisi (required)
        </label>
      </div>

      {isChoiceType && (
        <div>
          <label htmlFor="field-options-input" className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            Opsi Pilihan (satu per baris)
          </label>
          <textarea
            id="field-options-input"
            rows={5}
            value={(selectedField.options ?? []).join('\n')}
            onChange={(e) => onSetOptions(selectedField.key, e.target.value.split('\n'))}
            placeholder="Opsi 1&#10;Opsi 2&#10;Opsi 3"
            className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
          />
        </div>
      )}

      <div className="mt-auto border-t border-[var(--color-border-hairline)] pt-3 text-xs text-[var(--color-text-muted)] font-mono">
        ID: {selectedField.key}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Tulis test BuilderCanvas yang gagal**

```tsx
// frontend/src/builder/components/BuilderCanvas.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderCanvas } from './BuilderCanvas';
import type { Schema } from '../types';

describe('BuilderCanvas', () => {
  it('menampilkan pesan kosong bila belum ada field', () => {
    const schema: Schema = { fields: [] };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey={null}
        onSelect={() => {}}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );
    expect(screen.getByText(/Tarik atau tambahkan field dari palet/i)).toBeInTheDocument();
  });

  it('merender setiap item field dengan label dan tipenya', () => {
    const schema: Schema = {
      fields: [
        { key: 'f_1', type: 'text', label: 'Nama' },
        { key: 'f_2', type: 'email', label: 'Email Kantor', required: true },
      ],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey="f_1"
        onSelect={() => {}}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );

    expect(screen.getByText('Nama')).toBeInTheDocument();
    expect(screen.getByText('Email Kantor')).toBeInTheDocument();
  });

  it('memanggil onSelect saat item diklik', async () => {
    const onSelect = vi.fn();
    const schema: Schema = {
      fields: [{ key: 'f_1', type: 'text', label: 'Nama' }],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey={null}
        onSelect={onSelect}
        onRemove={() => {}}
        onMove={() => {}}
      />
    );

    await userEvent.click(screen.getByText('Nama'));
    expect(onSelect).toHaveBeenCalledWith('f_1');
  });

  it('memanggil onRemove saat tombol hapus diklik', async () => {
    const onRemove = vi.fn();
    const schema: Schema = {
      fields: [{ key: 'f_1', type: 'text', label: 'Nama' }],
    };
    render(
      <BuilderCanvas
        schema={schema}
        selectedKey={null}
        onSelect={() => {}}
        onRemove={onRemove}
        onMove={() => {}}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Hapus field f_1/i }));
    expect(onRemove).toHaveBeenCalledWith('f_1');
  });
});
```

- [ ] **Step 5: Implementasi SortableFieldItem & BuilderCanvas**

`frontend/src/builder/components/SortableFieldItem.tsx`:
```tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FIELD_LABELS } from '../fieldTypes';
import type { Field } from '../types';

interface SortableFieldItemProps {
  field: Field;
  isSelected: boolean;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
}

export function SortableFieldItem({ field, isSelected, onSelect, onRemove }: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.key)}
      className={`group flex items-center justify-between rounded border p-3 cursor-pointer transition-colors ${
        isSelected
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-surface-elevated)]'
          : 'border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] hover:border-[var(--color-text-muted)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Pindahkan field ${field.label}`}
          className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-mono text-sm px-1 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          :::
        </button>
        <div>
          <div className="flex items-center gap-1.5 font-medium text-sm text-[var(--color-text-primary)]">
            <span>{field.label}</span>
            {field.required && <span className="text-[var(--color-accent-danger)]">*</span>}
          </div>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {FIELD_LABELS[field.type]} · {field.key}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-label={`Hapus field ${field.key}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(field.key);
        }}
        className="opacity-0 group-hover:opacity-100 rounded px-2 py-1 text-xs text-[var(--color-accent-danger)] hover:bg-[var(--color-surface-primary)] transition-opacity"
      >
        Hapus
      </button>
    </div>
  );
}
```

`frontend/src/builder/components/BuilderCanvas.tsx`:
```tsx
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableFieldItem } from './SortableFieldItem';
import type { Schema } from '../types';

interface BuilderCanvasProps {
  schema: Schema;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, toIndex: number) => void;
}

export function BuilderCanvas({ schema, selectedKey, onSelect, onRemove, onMove }: BuilderCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const targetIndex = schema.fields.findIndex((f) => f.key === over.id);
      if (targetIndex !== -1) {
        onMove(String(active.id), targetIndex);
      }
    }
  };

  if (schema.fields.length === 0) {
    return (
      <section
        aria-label="Kanvas Form"
        className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-border-hairline)] m-4 rounded"
      >
        Tarik atau tambahkan field dari palet untuk mulai mendesain form.
      </section>
    );
  }

  return (
    <section aria-label="Kanvas Form" className="flex-1 overflow-y-auto p-6" onClick={() => onSelect(null)}>
      <div className="mx-auto max-w-xl flex flex-col gap-2.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={schema.fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
            {schema.fields.map((field) => (
              <SortableFieldItem
                key={field.key}
                field={field}
                isSelected={selectedKey === field.key}
                onSelect={(k) => onSelect(k)}
                onRemove={onRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Buat BuilderView koordinator & integrasikan ke edit page**

`frontend/src/builder/components/BuilderView.tsx`:
```tsx
'use client';

import { useReducer, useState } from 'react';
import { FieldPalette } from './FieldPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { FieldConfigPanel } from './FieldConfigPanel';
import { schemaReducer } from '../schema';
import type { Schema } from '../types';

interface BuilderViewProps {
  initialSchema: Schema;
  title: string;
  onSave?: (schema: Schema) => void;
}

export function BuilderView({ initialSchema, title, onSave }: BuilderViewProps) {
  const [schema, dispatch] = useReducer(schemaReducer, initialSchema);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedField = schema.fields.find((f) => f.key === selectedKey) ?? null;

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2 bg-[var(--color-surface-primary)]">
        <h1 className="text-sm font-semibold">{title}</h1>
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(schema)}
            className="rounded bg-[var(--color-accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-primary)] hover:opacity-90 transition-opacity"
          >
            Simpan Draft
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <FieldPalette onAdd={(type) => dispatch({ type: 'add_field', fieldType: type })} />
        <BuilderCanvas
          schema={schema}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onRemove={(key) => {
            dispatch({ type: 'remove_field', key });
            if (selectedKey === key) setSelectedKey(null);
          }}
          onMove={(key, toIndex) => dispatch({ type: 'move_field', key, toIndex })}
        />
        <FieldConfigPanel
          selectedField={selectedField}
          onUpdate={(key, patch) => dispatch({ type: 'update_field', key, patch })}
          onSetOptions={(key, options) => dispatch({ type: 'set_options', key, options })}
        />
      </div>
    </div>
  );
}
```

Update `frontend/src/app/forms/[id]/edit/page.tsx`:
```tsx
import { BuilderView } from '@/builder/components/BuilderView';
import { emptySchema } from '@/builder/schema';

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuilderView initialSchema={emptySchema()} title={`Edit Form ${id}`} />;
}
```

- [ ] **Step 7: Jalankan test Task 5, pastikan PASS**

Run: `cd frontend && npx vitest run src/builder/components/`
Expected: PASS (FieldPalette, FieldConfigPanel, BuilderCanvas — semua hijau).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/builder/components/ \
        frontend/src/app/forms/[id]/edit/page.tsx
git commit -m "feat(frontend): add drag-drop builder canvas and field config panel"
```

---

### Task 6: API Client & Persist Draft (Next.js ↔ Laravel)

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/builder/hooks/useFormBuilder.ts`
- Test: `frontend/src/lib/api.test.ts`
- Test: `frontend/src/builder/hooks/useFormBuilder.test.ts`
- Modify: `frontend/src/builder/components/BuilderView.tsx`
- Modify: `frontend/src/app/forms/[id]/edit/page.tsx`

**Interfaces:**
- Consumes:
  - Laravel API endpoints dari Task 2: `GET /api/forms/{id}`, `PATCH /api/forms/{id}`
  - `Schema` dari `src/builder/types.ts`
  - `schemaReducer` dari `src/builder/schema.ts`
- Produces:
  - `FormDetail`: interface `{ id: string, title: string, slug: string, status: string, draft_schema: Schema }`
  - `api.fetchForm(id, token?)`: memanggil endpoint Laravel, parse envelope `{ success, data }`
  - `api.saveDraft(id, schema, token?)`: mengirim `{ draft_schema: schema }` via `PATCH /api/forms/{id}`
  - `useFormBuilder(formId, token?)`: hook mengelola fetching draft awal, state form, debounce/manual autosave, state status: `'idle' | 'saving' | 'saved' | 'error'`.

- [ ] **Step 1: Tulis test API client yang gagal**

```ts
// frontend/src/lib/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForm, saveDraft } from './api';

describe('API Client — fetchForm & saveDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchForm mengembalikan FormDetail saat respons sukses', async () => {
    const mockForm = {
      id: 'uuid-1',
      title: 'Survey Mahasiswa',
      slug: 'survey-mahasiswa',
      status: 'draft',
      draft_schema: { fields: [{ key: 'f_1', type: 'text', label: 'Nama' }] },
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockForm, meta: {} }),
    } as Response);

    const result = await fetchForm('uuid-1');
    expect(result).toEqual(mockForm);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/uuid-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchForm melempar error saat server mengembalikan gagal', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: { message: 'Not found' } }),
    } as Response);

    await expect(fetchForm('uuid-unknown')).rejects.toThrow(/Not found/);
  });

  it('saveDraft mengirim PATCH dengan draft_schema', async () => {
    const schema = { fields: [{ key: 'f_1', type: 'text' as const, label: 'Alamat' }] };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'uuid-1', draft_schema: schema } }),
    } as Response);

    await saveDraft('uuid-1', schema);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/forms/uuid-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ draft_schema: schema }),
      })
    );
  });
});
```

- [ ] **Step 2: Jalankan test API client, pastikan GAGAL**

Run: `cd frontend && npx vitest run src/lib/api.test.ts`
Expected: FAIL — `Cannot find module './api'`.

- [ ] **Step 3: Implementasi API client**

```ts
// frontend/src/lib/api.ts
import type { Schema } from '../builder/types';

export interface FormDetail {
  id: string;
  title: string;
  slug: string;
  status: string;
  draft_schema: Schema;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export async function fetchForm(id: string, token?: string): Promise<FormDetail> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/forms/${id}`, {
    method: 'GET',
    headers,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || `Gagal memuat form (status: ${res.status})`);
  }

  return json.data as FormDetail;
}

export async function saveDraft(id: string, schema: Schema, token?: string): Promise<FormDetail> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/forms/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ draft_schema: schema }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || `Gagal menyimpan draft (status: ${res.status})`);
  }

  return json.data as FormDetail;
}
```

- [ ] **Step 4: Tulis test useFormBuilder hook yang gagal**

```tsx
// frontend/src/builder/hooks/useFormBuilder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormBuilder } from './useFormBuilder';
import * as api from '../../lib/api';

describe('useFormBuilder hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menginisialisasi schema kosong saat memuat', () => {
    vi.spyOn(api, 'fetchForm').mockImplementation(() => new Promise(() => {})); // pending
    const { result } = renderHook(() => useFormBuilder('uuid-1'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.schema).toEqual({ fields: [] });
  });

  it('memuat schema dan title dari API', async () => {
    vi.spyOn(api, 'fetchForm').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Pendaftaran Anggota',
      slug: 'pendaftaran-anggota',
      status: 'draft',
      draft_schema: { fields: [{ key: 'f_1', type: 'text', label: 'Nama' }] },
    });

    const { result } = renderHook(() => useFormBuilder('uuid-1'));

    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.title).toBe('Pendaftaran Anggota');
    expect(result.current.schema.fields).toHaveLength(1);
    expect(result.current.schema.fields[0].key).toBe('f_1');
  });

  it('menyimpan schema saat save dipanggil dan mengubah status jadi saved', async () => {
    vi.spyOn(api, 'fetchForm').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Test Form',
      slug: 'test-form',
      status: 'draft',
      draft_schema: { fields: [] },
    });
    const saveSpy = vi.spyOn(api, 'saveDraft').mockResolvedValueOnce({
      id: 'uuid-1',
      title: 'Test Form',
      slug: 'test-form',
      status: 'draft',
      draft_schema: { fields: [{ key: 'f_1', type: 'text', label: 'Teks' }] },
    });

    const { result } = renderHook(() => useFormBuilder('uuid-1'));
    await act(async () => {});

    act(() => {
      result.current.dispatch({ type: 'add_field', fieldType: 'text' });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(saveSpy).toHaveBeenCalledWith('uuid-1', expect.objectContaining({
      fields: expect.arrayContaining([expect.objectContaining({ type: 'text' })]),
    }), undefined);
    expect(result.current.saveStatus).toBe('saved');
  });
});
```

- [ ] **Step 5: Implementasi useFormBuilder hook**

```ts
// frontend/src/builder/hooks/useFormBuilder.ts
import { useEffect, useReducer, useState } from 'react';
import { schemaReducer, emptySchema } from '../schema';
import { fetchForm, saveDraft } from '../../lib/api';
import type { Schema } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useFormBuilder(formId: string, token?: string) {
  const [schema, dispatch] = useReducer(schemaReducer, emptySchema());
  const [title, setTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchForm(formId, token)
      .then((form) => {
        if (cancelled) return;
        setTitle(form.title);
        if (form.draft_schema && Array.isArray(form.draft_schema.fields)) {
          dispatch({ type: 'replace', schema: form.draft_schema });
        }
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId, token]);

  const save = async () => {
    setSaveStatus('saving');
    try {
      await saveDraft(formId, schema, token);
      setSaveStatus('saved');
    } catch (err: unknown) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Gagal menyimpan draft');
    }
  };

  return {
    schema,
    dispatch,
    title,
    isLoading,
    error,
    saveStatus,
    save,
  };
}
```

- [ ] **Step 6: Update BuilderView & Edit Page untuk menggunakan hook dan status save**

Update `frontend/src/builder/components/BuilderView.tsx`:
Tambahkan indikator `saveStatus` (Anti-Slop Design Contract states: loading, saved, error, saving):

```tsx
'use client';

import { useState } from 'react';
import { FieldPalette } from './FieldPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { FieldConfigPanel } from './FieldConfigPanel';
import type { Schema, SchemaAction } from '../types';
import type { SaveStatus } from '../hooks/useFormBuilder';

interface BuilderViewProps {
  schema: Schema;
  dispatch: React.Dispatch<SchemaAction>;
  title: string;
  saveStatus?: SaveStatus;
  onSave?: () => void;
  isLoading?: boolean;
}

export function BuilderView({ schema, dispatch, title, saveStatus = 'idle', onSave, isLoading }: BuilderViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedField = schema.fields.find((f) => f.key === selectedKey) ?? null;

  if (isLoading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] text-sm">
        Memuat form...
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2 bg-[var(--color-surface-primary)]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{title}</h1>
          {saveStatus === 'saving' && <span className="text-xs text-[var(--color-accent-warning)]">Menyimpan...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-[var(--color-accent-success)]">Draft tersimpan</span>}
          {saveStatus === 'error' && <span className="text-xs text-[var(--color-accent-danger)]">Gagal simpan</span>}
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            className="rounded bg-[var(--color-accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Simpan Draft
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <FieldPalette onAdd={(type) => dispatch({ type: 'add_field', fieldType: type })} />
        <BuilderCanvas
          schema={schema}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onRemove={(key) => {
            dispatch({ type: 'remove_field', key });
            if (selectedKey === key) setSelectedKey(null);
          }}
          onMove={(key, toIndex) => dispatch({ type: 'move_field', key, toIndex })}
        />
        <FieldConfigPanel
          selectedField={selectedField}
          onUpdate={(key, patch) => dispatch({ type: 'update_field', key, patch })}
          onSetOptions={(key, options) => dispatch({ type: 'set_options', key, options })}
        />
      </div>
    </div>
  );
}
```

Update `frontend/src/app/forms/[id]/edit/page.tsx`:
```tsx
'use client';

import { use } from 'react';
import { BuilderView } from '@/builder/components/BuilderView';
import { useFormBuilder } from '@/builder/hooks/useFormBuilder';

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { schema, dispatch, title, isLoading, error, saveStatus, save } = useFormBuilder(id);

  if (error) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center p-6 text-center">
        <p className="text-sm text-[var(--color-accent-danger)]">{error}</p>
      </main>
    );
  }

  return (
    <BuilderView
      schema={schema}
      dispatch={dispatch}
      title={title || `Form ${id}`}
      saveStatus={saveStatus}
      onSave={save}
      isLoading={isLoading}
    />
  );
}
```

- [ ] **Step 7: Jalankan test Task 6, pastikan PASS**

Run: `cd frontend && npx vitest run src/lib/api.test.ts src/builder/hooks/useFormBuilder.test.ts`
Expected: PASS (Semua test API client dan hook hijau).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts \
        frontend/src/builder/hooks/ \
        frontend/src/builder/components/BuilderView.tsx \
        frontend/src/app/forms/[id]/edit/page.tsx
git commit -m "feat(frontend): integrate builder with laravel forms api and draft persistence"
```

---

### Task 7: Gerbang Milestone 2 — Local-CI & E2E Smoke Playwright

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/builder.smoke.spec.ts`
- Modify: `docs/superpowers/plans/2026-09-18-plan-2-builder.md` (checkbox status)

**Interfaces:**
- Consumes: seluruh task di atas (Plan 1 + Task 1–6).
- Produces: `scripts/local-ci.sh --tier t0 --fast` menjalankan SEMUA gate:
  - `secrets` (gitleaks)
  - `node:lint` (`frontend/`)
  - `node:typecheck` (`frontend/`)
  - `node:test` (`frontend/` vitest)
  - `node:audit` (`frontend/` npm audit dengan committed lockfile)
  - `node:license` (`frontend/` no GPL/AGPL)
  - `node:build` (`frontend/` next build)
  - `php:test` (`backend/` php artisan test — 57+ tests)
  - `php:audit` (`backend/` composer audit)
  - E2E smoke Playwright: halaman `/forms/test-id/edit` merender palette 9 tombol + canvas kosong.

- [ ] **Step 1: Konfigurasi Playwright**

`frontend/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  fullyParallel: true,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
```

- [ ] **Step 2: Tulis Playwright Smoke Test**

`frontend/e2e/builder.smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.describe('Form Builder UI Smoke', () => {
  test('halaman edit memuat palette dengan 9 tombol dan canvas awal', async ({ page }) => {
    // Intercept API call ke backend agar test UI independen dari data seed
    await page.route('**/api/forms/smoke-form-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'smoke-form-1',
            title: 'Formulir Pendaftaran Uji',
            slug: 'formulir-pendaftaran-uji',
            status: 'draft',
            draft_schema: { fields: [] },
          },
          meta: {},
        }),
      });
    });

    await page.goto('/forms/smoke-form-1/edit');

    // 1. Header menampilkan judul form
    await expect(page.getByRole('heading', { name: 'Formulir Pendaftaran Uji' })).toBeVisible();

    // 2. Palette memiliki 9 jenis field
    const paletteButtons = page.getByRole('button', { name: /^Tambah field / });
    await expect(paletteButtons).toHaveCount(9);

    // 3. Tambah field Email ke canvas
    await page.getByRole('button', { name: 'Tambah field Email' }).click();

    // 4. Canvas menampilkan item Email
    await expect(page.getByText('Email · f_1')).toBeVisible();

    // 5. Config panel muncul dan menampilkan label field
    await expect(page.getByLabel('Label Field')).toHaveValue('Email');
  });
});
```

- [ ] **Step 3: Tambahkan script test:e2e di package.json frontend**

Pastikan di `frontend/package.json` ada:
`"test:e2e": "playwright test"`

- [ ] **Step 4: Jalankan gate penuh secara lokal**

Run:
```bash
bash scripts/local-ci.sh --tier t0 --fast
```
Expected:
```
================================================================
 SUMMARY
================================================================
  ok    secrets
  ok    node:lint
  ok    node:typecheck
  ok    node:test
  ok    node:audit
  ok    node:license
  ok    node:build
  ok    php:test
  ok    php:audit
  SKIP  e2e — --fast
  SKIP  a11y — --fast
  SKIP  perf — --fast
----------------------------------------------------------------
 LOCAL-CI: ALL GREEN
================================================================
```

- [ ] **Step 5: Jalankan smoke E2E test**

Run:
```bash
cd frontend && npx playwright test
```
Expected: `1 passed`.

- [ ] **Step 6: Mutation check gate node (SOP: gate yang tidak bisa gagal itu dekorasi)**

Uji bahwa salah satu gate node bisa merah:
1. Rusak salah satu test di `frontend/src/builder/schema.test.ts` (`expect(true).toBe(false)`).
2. Jalankan `bash scripts/local-ci.sh --tier t0 --fast`.
3. Pastikan `EXIT=1` dan summary menampilkan `FAIL node:test`.
4. Restore file (`git checkout -- frontend/src/builder/schema.test.ts`), pastikan hijau kembali.

- [ ] **Step 7: Commit**

```bash
git add frontend/playwright.config.ts frontend/e2e/ \
        frontend/package.json
git commit -m "ci: add playwright smoke test and verify all local-ci gates for milestone 2"
```

---

## Definition of Done — Milestone 2

- [ ] Next.js app berjalan di `frontend/` dengan design token Rukun (spec §6).
- [ ] Tabel `forms` ter-migrasi di Postgres + model `Form` relasi ke `Workspace`.
- [ ] CRUD API `/api/forms` di Laravel berfungsi dengan validasi `draft_schema` via `FormSchema` (Plan 1) dan otorisasi `FormPolicy`.
- [ ] Reducer builder (`schema.ts`) lulus **24 unit test** TDD murni (immutable, batas 50 field, format `f_<n>`).
- [ ] Canvas drag-drop (`@dnd-kit/sortable`) memungkinkan penambahan dari palette, reorder, hapus, dan seleksi field.
- [ ] Panel konfigurasi mengedit label, toggle required, dan opsi (untuk choice/multi_choice).
- [ ] Draft tersimpan ke backend via `PATCH /api/forms/{id}` dengan feedback status visual.
- [ ] Playwright E2E smoke test lulus.
- [ ] `scripts/local-ci.sh --tier t0 --fast` **ALL GREEN** (lint, typecheck, test, audit, license, build untuk Node & PHP).
- [ ] Gate terbukti bisa MERAH saat test dirusak.

## Batas Plan 2 (dicatat eksplisit, bukan gap diam-diam)

Plan 2 menghasilkan **Builder UI dan penyimpanan draft schema**, tetapi:
1. **Belum** membuat tabel `form_versions` atau endpoint `/api/forms/{id}/publish`. Alur publish, penguncian versi immutable, dan publikasi ke Go edge berada di **Plan 3 (Publish & Render)**.
2. **Belum** menyertakan conditional logic (show/hide if). Schema reducer saat ini fokus pada 9 tipe field, atribut dasar, dan opsi pilihan; conditional logic mendarat di **Plan 5 (Logic)**.
3. Form render publik (`/f/[slug]`) dan penerimaan submission berada di **Plan 3**.
