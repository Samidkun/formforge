<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FormPublishTest extends TestCase
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

    public function test_publish_requires_authentication(): void
    {
        $response = $this->postJson('/api/forms/00000000-0000-0000-0000-000000000000/publish');
        $response->assertStatus(401);
    }

    public function test_publish_rejects_empty_or_invalid_schema(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Empty Form',
            'slug' => 'empty-form',
            'status' => 'draft',
            'draft_schema' => ['fields' => []],
        ]);

        $response = $this->postJson("/api/forms/{$form->id}/publish");
        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
        $response->assertJsonPath('error.code', 'INVALID_SCHEMA');
    }

    public function test_publish_creates_first_version_and_updates_status(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $validSchema = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Name', 'required' => true],
                ['key' => 'f_2', 'type' => 'email', 'label' => 'Email', 'required' => false],
            ],
        ];

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Registration',
            'slug' => 'registration',
            'status' => 'draft',
            'draft_schema' => $validSchema,
        ]);

        $response = $this->postJson("/api/forms/{$form->id}/publish");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.form.status', 'published');
        $response->assertJsonPath('data.version.version_no', 1);
        $response->assertJsonPath('data.version.schema', $validSchema);

        $freshForm = $form->fresh();
        $this->assertEquals('published', $freshForm->status);
        $this->assertNotNull($freshForm->current_version_id);
        $this->assertEquals(1, $freshForm->currentVersion->version_no);
        $this->assertEquals($validSchema, $freshForm->currentVersion->schema);
    }

    public function test_publish_subsequent_time_increments_version_number(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $schemaV1 = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Name', 'required' => true],
            ],
        ];

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Lead Gen',
            'slug' => 'lead-gen',
            'status' => 'draft',
            'draft_schema' => $schemaV1,
        ]);

        $this->postJson("/api/forms/{$form->id}/publish")->assertStatus(200);

        // Modify draft schema and publish again
        $schemaV2 = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Full Name', 'required' => true],
                ['key' => 'f_2', 'type' => 'rating', 'label' => 'Score', 'required' => false],
            ],
        ];

        $form->update(['draft_schema' => $schemaV2]);

        $response2 = $this->postJson("/api/forms/{$form->id}/publish");
        $response2->assertStatus(200);
        $response2->assertJsonPath('data.version.version_no', 2);

        $this->assertCount(2, $form->fresh()->formVersions);
        $this->assertEquals(2, $form->fresh()->currentVersion->version_no);
        $this->assertEquals($schemaV2, $form->fresh()->currentVersion->schema);

        // Historical version 1 remains unchanged
        $v1 = $form->formVersions()->where('version_no', 1)->first();
        $this->assertEquals($schemaV1, $v1->schema);
    }

    public function test_publish_forbidden_for_other_users_form(): void
    {
        [$owner, $workspace] = $this->createWorkspaceAndUser();
        $otherUser = User::factory()->create();

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Secret Form',
            'slug' => 'secret-form',
            'status' => 'draft',
            'draft_schema' => [
                'fields' => [['key' => 'f_1', 'type' => 'text', 'label' => 'Hi']],
            ],
        ]);

        Sanctum::actingAs($otherUser);
        $response = $this->postJson("/api/forms/{$form->id}/publish");
        $response->assertStatus(403);
    }
}
