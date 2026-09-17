<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Envelope contract (plan Interfaces + spec 3.4 + ruling T5-2): auth
        // failures must return {success:false, error:{code,message}, meta:{}},
        // not Laravel's raw {"message":"..."} body. Only these two are handled;
        // every other exception keeps its normal behavior.
        $envelope = function (string $code, string $message, int $status) {
            return response()->json([
                'success' => false,
                'error'   => ['code' => $code, 'message' => $message],
                'meta'    => new \stdClass(),
            ], $status);
        };

        $exceptions->render(function (AuthenticationException $e, $request) use ($envelope) {
            if ($request->expectsJson()) {
                return $envelope('UNAUTHENTICATED', 'Unauthenticated.', 401);
            }
        });

        $exceptions->render(function (AuthorizationException $e, $request) use ($envelope) {
            if ($request->expectsJson()) {
                return $envelope('FORBIDDEN', 'This action is unauthorized.', 403);
            }
        });

        $exceptions->render(function (AccessDeniedHttpException $e, $request) use ($envelope) {
            if ($request->expectsJson()) {
                return $envelope('FORBIDDEN', 'This action is unauthorized.', 403);
            }
        });
    })->create();
