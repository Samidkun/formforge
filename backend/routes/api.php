<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\HealthController;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->get('/me', [AuthController::class, 'me']);

// Test-only route (ruling T6-2): the 403 envelope handler in bootstrap/app.php
// (AuthorizationException / AccessDeniedHttpException) had no test. This route
// throws AuthorizationException so a feature test can assert the envelope.
// Guarded by environment('testing') so it is NEVER registered in prod/staging —
// it changes no application behavior.
if (app()->environment('testing')) {
    Route::get('/_test/forbidden', function () {
        throw new AuthorizationException('This action is unauthorized.');
    });
}
