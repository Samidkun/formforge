<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormVersion;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResponseApiTest extends TestCase
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

    public function test_responses_requires_authentication(): void
    {
        $response = $this->getJson('/api/forms/00000000-0000-0000-0000-000000000000/responses');
        $response->assertStatus(401);
    }

    public function test_responses_forbidden_for_other_users_form(): void
    {
        [$owner, $workspace] = $this->createWorkspaceAndUser();
        $otherUser = User::factory()->create();

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Secret Form',
            'slug' => 'secret-form',
            'status' => 'published',
        ]);

        Sanctum::actingAs($otherUser);
        $response = $this->getJson("/api/forms/{$form->id}/responses");
        $response->assertStatus(403);
    }

    public function test_responses_returns_paginated_submissions_with_answers(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Customer Feedback',
            'slug' => 'customer-feedback',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => [['key' => 'f_1', 'type' => 'text', 'label' => 'Name']]],
            'published_at' => now(),
        ]);

        $sub1 = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'complete',
            'started_at' => now()->subMinutes(1),
            'completed_at' => now(),
        ]);
        SubmissionAnswer::create([
            'submission_id' => $sub1->id,
            'field_key' => 'f_1',
            'value' => 'Alice',
        ]);

        $sub2 = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'partial',
            'started_at' => now(),
        ]);
        SubmissionAnswer::create([
            'submission_id' => $sub2->id,
            'field_key' => 'f_1',
            'value' => 'Bob',
        ]);

        $response = $this->getJson("/api/forms/{$form->id}/responses");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonCount(2, 'data.items');
        $this->assertEquals('complete', $response->json('data.items.0.status'));
        $this->assertEquals('Alice', $response->json('data.items.0.answers.0.value'));
        $this->assertEquals(2, $response->json('meta.total'));
    }

    public function test_responses_can_be_filtered_by_status(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Poll',
            'slug' => 'poll',
            'status' => 'published',
        ]);
        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => []],
        ]);

        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'complete',
        ]);
        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'partial',
        ]);

        $response = $this->getJson("/api/forms/{$form->id}/responses?status=complete");
        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data.items');
        $this->assertEquals('complete', $response->json('data.items.0.status'));
    }
}
