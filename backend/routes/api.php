<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FormController;
use App\Http\Controllers\Api\ResponseController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\HealthController;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/uploads', [UploadController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/forms', [FormController::class, 'index']);
    Route::post('/forms', [FormController::class, 'store']);
    Route::get('/forms/{form}', [FormController::class, 'show']);
    Route::patch('/forms/{form}', [FormController::class, 'update']);
    Route::delete('/forms/{form}', [FormController::class, 'destroy']);
    Route::post('/forms/{id}/publish', [FormController::class, 'publish']);
    Route::get('/forms/{id}/responses', [ResponseController::class, 'index']);
    Route::get('/forms/{id}/responses/export', [ResponseController::class, 'export']);
    Route::get('/forms/{id}/analytics', [AnalyticsController::class, 'show']);
});

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
