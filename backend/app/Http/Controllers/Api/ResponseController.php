<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Form;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function export(string $id): StreamedResponse
    {
        $form = Form::with('currentVersion')->findOrFail($id);
        Gate::authorize('view', $form);

        $schema = $form->currentVersion->schema ?? $form->draft_schema ?? ['fields' => []];
        $fields = $schema['fields'] ?? [];

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="form-%s-responses.csv"', $form->slug),
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($form, $fields) {
            $handle = fopen('php://output', 'w');

            // Header row
            $headerRow = ['Submission ID', 'Session ID', 'Status', 'Started At', 'Completed At'];
            foreach ($fields as $f) {
                $headerRow[] = $f['label'] ?? $f['key'];
            }
            fputcsv($handle, $headerRow);

            // Chunk submissions to avoid memory exhaustion
            $form->submissions()->with('answers')->chunk(200, function ($submissions) use ($handle, $fields) {
                foreach ($submissions as $sub) {
                    $answerMap = [];
                    foreach ($sub->answers as $ans) {
                        $val = $ans->value;
                        if (is_array($val)) {
                            $answerMap[$ans->field_key] = implode(', ', $val);
                        } else {
                            $answerMap[$ans->field_key] = (string) $val;
                        }
                    }

                    $row = [
                        $sub->id,
                        $sub->session_id,
                        $sub->status,
                        $sub->started_at?->toIso8601String() ?? '',
                        $sub->completed_at?->toIso8601String() ?? '',
                    ];

                    foreach ($fields as $f) {
                        $row[] = $answerMap[$f['key']] ?? '';
                    }

                    fputcsv($handle, $row);
                }
            });

            fclose($handle);
        }, 200, $headers);
    }
}
