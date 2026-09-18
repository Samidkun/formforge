<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ResponseController extends Controller
{
    public function index(Request $request, string $id): JsonResponse
    {
        $form = Form::findOrFail($id);
        Gate::authorize('view', $form);

        $query = $form->submissions()->with('answers')->latest();

        if ($request->has('status') && in_array($request->query('status'), ['partial', 'complete'], true)) {
            $query->where('status', $request->query('status'));
        }

        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $paginated->items(),
            ],
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'last_page' => $paginated->lastPage(),
            ],
        ]);
    }
}
