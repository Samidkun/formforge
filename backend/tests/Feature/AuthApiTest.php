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
        $this->getJson('/api/me')
            ->assertStatus(401)
            ->assertJsonPath('success', false);
    }

    public function test_login_validation_error_uses_envelope(): void
    {
        $this->postJson('/api/login', ['email' => 'bukan-email', 'password' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['success', 'error' => ['code', 'message'], 'meta']);
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
