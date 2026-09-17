<?php
// backend/app/Http/Controllers/Api/AuthController.php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    private function envelope(array $data, int $status = 200)
    {
        return response()->json([
            'success' => $status < 400,
            'data'    => $data,
            'meta'    => new \stdClass(),
        ], $status);
    }

    public function register(RegisterRequest $r)
    {
        $user = User::create([
            'name'     => $r->name,
            'email'    => $r->email,
            'password' => Hash::make($r->password),
        ]);
        Workspace::create(['owner_id' => $user->id, 'name' => "{$user->name} Workspace"]);
        $token = $user->createToken('api')->plainTextToken;

        return $this->envelope(['user' => $user, 'token' => $token], 201);
    }

    public function login(Request $r)
    {
        $r->validate(['email' => ['required','email'], 'password' => ['required','string']]);
        $user = User::where('email', $r->email)->first();
        if (!$user || !Hash::check($r->password, $user->password)) {
            return response()->json([
                'success' => false,
                'error'   => ['code' => 'INVALID_CREDENTIALS', 'message' => 'Email atau password salah'],
                'meta'    => new \stdClass(),
            ], 422);
        }
        return $this->envelope(['user' => $user, 'token' => $user->createToken('api')->plainTextToken]);
    }

    public function me(Request $r)
    {
        // Test contract: GET /api/me returns the user as `data` (asserts data.email).
        return $this->envelope($r->user()->toArray());
    }
}
