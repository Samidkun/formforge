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
        $this->assertSame('Toko A', $user->workspaces->first()->name);
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
