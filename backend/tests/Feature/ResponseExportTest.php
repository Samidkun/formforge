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

class ResponseExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_requires_authentication(): void
    {
        $response = $this->getJson('/api/forms/00000000-0000-0000-0000-000000000000/responses/export');
        $response->assertStatus(401);
    }

    public function test_export_streams_csv_with_headers_and_answers(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W1']);
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Event Sign-up',
            'slug' => 'event-signup',
            'status' => 'published',
            'draft_schema' => [
                'fields' => [
                    ['key' => 'f_name', 'type' => 'text', 'label' => 'Nama Lengkap'],
                    ['key' => 'f_email', 'type' => 'email', 'label' => 'Alamat Email'],
                ],
            ],
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => $form->draft_schema,
            'published_at' => now(),
        ]);
        $form->update(['current_version_id' => $version->id]);

        $sub = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => (string) Str::uuid(),
            'status' => 'complete',
            'started_at' => '2026-09-18 10:00:00',
            'completed_at' => '2026-09-18 10:02:00',
        ]);

        SubmissionAnswer::create(['submission_id' => $sub->id, 'field_key' => 'f_name', 'value' => 'Budi Santoso']);
        SubmissionAnswer::create(['submission_id' => $sub->id, 'field_key' => 'f_email', 'value' => 'budi@example.com']);

        $response = $this->get("/api/forms/{$form->id}/responses/export");
        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('attachment; filename="form-event-signup-responses.csv"', (string) $response->headers->get('Content-Disposition'));

        $content = $response->streamedContent();
        $lines = array_map('str_getcsv', array_filter(explode("\n", trim($content))));
        $this->assertSame(['Submission ID', 'Session ID', 'Status', 'Started At', 'Completed At', 'Nama Lengkap', 'Alamat Email'], $lines[0]);
        $this->assertSame('Budi Santoso', $lines[1][5]);
        $this->assertSame('budi@example.com', $lines[1][6]);
    }
}
