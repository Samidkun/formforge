<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UploadApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_uploads_valid_file_successfully(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 500, 'application/pdf');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'filename' => 'document.pdf',
                    'mime' => 'application/pdf',
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data['id']);
        $this->assertNotEmpty($data['url']);
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $data['url']));

        $this->assertDatabaseHas('uploads', [
            'id' => $data['id'],
            'filename' => 'document.pdf',
        ]);
    }

    public function test_uploads_valid_image_successfully(): void
    {
        $file = UploadedFile::fake()->image('photo.jpg', 600, 400)->size(300);

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'filename' => 'photo.jpg',
                ],
            ]);

        $data = $response->json('data');
        $this->assertNotEmpty($data['id']);
        $this->assertNotEmpty($data['url']);
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $data['url']));

        $this->assertDatabaseHas('uploads', [
            'id' => $data['id'],
            'filename' => 'photo.jpg',
        ]);
    }

    public function test_uploads_with_form_and_submission_id(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'WS', 'owner_id' => $user->id]);
        $form = Form::create(['workspace_id' => $workspace->id, 'title' => 'Form', 'slug' => 'form-upload-test']);
        $version = $form->formVersions()->create(['version_no' => 1, 'schema' => ['fields' => []]]);
        $submission = $form->submissions()->create(['form_version_id' => $version->id, 'session_id' => (string) \Illuminate\Support\Str::uuid()]);

        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
            'form_id' => $form->id,
            'submission_id' => $submission->id,
        ]);

        $response->assertStatus(201);
        $data = $response->json('data');

        $this->assertDatabaseHas('uploads', [
            'id' => $data['id'],
            'form_id' => $form->id,
            'submission_id' => $submission->id,
        ]);

        $upload = \App\Models\Upload::find($data['id']);
        $this->assertEquals($form->id, $upload->form->id);
        $this->assertEquals($submission->id, $upload->submission->id);
        $this->assertTrue($form->uploads->contains($upload));
        $this->assertTrue($submission->uploads->contains($upload));
    }

    public function test_rejects_disallowed_file_extension(): void
    {
        $file = UploadedFile::fake()->create('exploit.exe', 100, 'application/x-msdownload');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_rejects_file_exceeding_max_size(): void
    {
        // 12MB > 10MB limit
        $file = UploadedFile::fake()->create('large.pdf', 12288, 'application/pdf');

        $response = $this->postJson('/api/uploads', [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }
}
