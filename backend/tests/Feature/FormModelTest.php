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
