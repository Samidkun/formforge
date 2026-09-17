<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

class HealthController extends Controller
{
    public function __invoke()
    {
        $db = 'down';
        try { DB::select('select 1'); $db = 'ok'; } catch (\Throwable $e) {}

        $cache = 'down';
        try { Redis::connection()->ping(); $cache = 'ok'; } catch (\Throwable $e) {}

        return response()->json([
            'success' => true,
            'data'    => ['db' => $db, 'cache' => $cache],
            'meta'    => new \stdClass(),
        ]);
    }
}
