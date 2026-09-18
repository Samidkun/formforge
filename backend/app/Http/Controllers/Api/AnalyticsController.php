<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Form;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class AnalyticsController extends Controller
{
    public function show(string $id): JsonResponse
    {
        $form = Form::with('currentVersion')->findOrFail($id);
        Gate::authorize('view', $form);

        // Completed sessions across events and submissions
        $completedEventSessions = $form->events()
            ->where('type', 'complete')
            ->pluck('session_id')
            ->all();

        $completedSubSessions = $form->submissions()
            ->where('status', 'complete')
            ->pluck('session_id')
            ->all();

        $completedSessionMap = array_fill_keys(
            array_unique(array_merge($completedEventSessions, $completedSubSessions)),
            true
        );

        // Funnel counts: views, starts, completes
        $views = $form->events()->where('type', 'view')->distinct('session_id')->count('session_id');

        $startEventSessions = $form->events()->where('type', 'start')->pluck('session_id')->all();
        $subSessions = $form->submissions()->pluck('session_id')->all();
        $starts = count(array_unique(array_merge($startEventSessions, $subSessions)));

        $completes = count($completedSessionMap);

        if ($form->dailyStats()->exists()) {
            $views = max($views, (int) $form->dailyStats()->sum('views'));
            $starts = max($starts, (int) $form->dailyStats()->sum('starts'));
            $completes = max($completes, (int) $form->dailyStats()->sum('completes'));
        }

        $conversionRate = $starts > 0 ? (float) round(($completes / $starts) * 100, 2) : 0.0;

        $funnel = [
            'views' => (int) $views,
            'starts' => (int) $starts,
            'completes' => (int) $completes,
            'conversion_rate' => $conversionRate,
        ];

        // Schema fields for dropoff
        $schema = $form->currentVersion?->schema ?? $form->draft_schema ?? ['fields' => []];
        $fields = $schema['fields'] ?? [];

        // Pre-fetch field-level event interactions (field_focus, field_blur)
        $fieldEvents = DB::table('form_events')
            ->where('form_id', $form->id)
            ->whereNotNull('field_key')
            ->whereIn('type', ['field_focus', 'field_blur'])
            ->select('field_key', 'session_id')
            ->get();

        // Pre-fetch submission answers
        $fieldAnswers = DB::table('submission_answers')
            ->join('submissions', 'submission_answers.submission_id', '=', 'submissions.id')
            ->where('submissions.form_id', $form->id)
            ->select('submission_answers.field_key', 'submissions.session_id')
            ->get();

        $fieldSessions = [];
        foreach ($fieldEvents as $fe) {
            $fieldSessions[$fe->field_key][$fe->session_id] = true;
        }
        foreach ($fieldAnswers as $fa) {
            $fieldSessions[$fa->field_key][$fa->session_id] = true;
        }

        $dropoff = [];
        foreach ($fields as $field) {
            $key = $field['key'] ?? $field['field_key'] ?? '';
            $sessions = array_keys($fieldSessions[$key] ?? []);
            $interactions = count($sessions);

            $dropouts = 0;
            foreach ($sessions as $sid) {
                if (!isset($completedSessionMap[$sid])) {
                    $dropouts++;
                }
            }

            $dropRate = $interactions > 0 ? (float) round(($dropouts / $interactions) * 100, 2) : 0.0;

            $dropoff[] = [
                'field_key' => $key,
                'label' => $field['label'] ?? $key,
                'type' => $field['type'] ?? 'text',
                'interactions' => $interactions,
                'dropouts' => $dropouts,
                'drop_rate' => $dropRate,
            ];
        }

        // Daily aggregated stats
        $daily = $form->dailyStats()
            ->orderBy('date', 'asc')
            ->get()
            ->map(function ($stat) {
                return [
                    'date' => is_string($stat->date) ? substr($stat->date, 0, 10) : $stat->date->format('Y-m-d'),
                    'views' => (int) $stat->views,
                    'starts' => (int) $stat->starts,
                    'completes' => (int) $stat->completes,
                ];
            })
            ->values()
            ->all();

        if (empty($daily)) {
            $daily = DB::table('form_events')
                ->where('form_id', $form->id)
                ->selectRaw("
                    CAST(created_at AS DATE) as date,
                    COUNT(DISTINCT CASE WHEN type = 'view' THEN session_id END) as views,
                    COUNT(DISTINCT CASE WHEN type = 'start' THEN session_id END) as starts,
                    COUNT(DISTINCT CASE WHEN type = 'complete' THEN session_id END) as completes
                ")
                ->groupBy(DB::raw('CAST(created_at AS DATE)'))
                ->orderBy(DB::raw('CAST(created_at AS DATE)'), 'asc')
                ->get()
                ->map(function ($row) {
                    return [
                        'date' => (string) $row->date,
                        'views' => (int) $row->views,
                        'starts' => (int) $row->starts,
                        'completes' => (int) $row->completes,
                    ];
                })
                ->values()
                ->all();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'funnel' => $funnel,
                'dropoff' => $dropoff,
                'daily' => $daily,
            ],
            'meta' => new \stdClass(),
        ]);
    }
}
