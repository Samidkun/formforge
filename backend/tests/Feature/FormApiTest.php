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
