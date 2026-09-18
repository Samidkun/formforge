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
use Tests\TestCase;

class SubmissionModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_form_has_versions_and_current_version(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create([
            'owner_id' => $user->id,
            'name' => 'Test Workspace',
        ]);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Survey Form',
            'slug' => 'survey-form',
            'status' => 'draft',
        ]);

        $schema = [
            'fields' => [
                ['key' => 'f_1', 'type' => 'text', 'label' => 'Full Name', 'required' => true],
            ],
        ];

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => $schema,
            'published_at' => now(),
        ]);

        $form->update([
            'status' => 'published',
            'current_version_id' => $version->id,
        ]);

        $this->assertCount(1, $form->fresh()->formVersions);
        $this->assertEquals(1, $form->fresh()->currentVersion->version_no);
        $this->assertEquals($schema, $version->fresh()->schema);
    }

    public function test_submission_belongs_to_form_and_version_with_answers(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W1']);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Feedback',
            'slug' => 'feedback',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => []],
            'published_at' => now(),
        ]);

        $sessionId = (string) Str::uuid();

        $submission = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sessionId,
            'status' => 'complete',
            'started_at' => now()->subMinutes(2),
            'completed_at' => now(),
            'meta' => ['browser' => 'Chrome'],
        ]);

        $answer = SubmissionAnswer::create([
            'submission_id' => $submission->id,
            'field_key' => 'f_1',
            'value' => 'Jane Doe',
        ]);

        $this->assertCount(1, $form->fresh()->submissions);
        $this->assertCount(1, $submission->fresh()->answers);
        $this->assertEquals('Jane Doe', $submission->fresh()->answers->first()->value);
        $this->assertEquals('complete', $submission->fresh()->status);
        $this->assertEquals(['browser' => 'Chrome'], $submission->fresh()->meta);
    }

    public function test_submission_session_id_is_unique_per_form(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W1']);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Lead Gen',
            'slug' => 'lead-gen',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => ['fields' => []],
            'published_at' => now(),
        ]);

        $sessionId = (string) Str::uuid();

        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sessionId,
            'status' => 'partial',
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sessionId,
            'status' => 'complete',
        ]);
    }
}
