<?php

namespace Tests\Feature;

use App\Jobs\RollupFormAnalyticsJob;
use App\Models\Form;
use App\Models\FormDailyStat;
use App\Models\FormEvent;
use App\Models\FormVersion;
use App\Models\Submission;
use App\Models\SubmissionAnswer;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AnalyticsApiTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceAndUser(): array
    {
        $user = User::factory()->create();
        $workspace = Workspace::create([
            'owner_id' => $user->id,
            'name' => 'Analytics Workspace',
        ]);

        return [$user, $workspace];
    }

    public function test_analytics_requires_authentication(): void
    {
        $response = $this->getJson('/api/forms/00000000-0000-0000-0000-000000000000/analytics');
        $response->assertStatus(401);
    }

    public function test_analytics_forbidden_for_other_users_form(): void
    {
        [$owner, $workspace] = $this->createWorkspaceAndUser();
        $otherUser = User::factory()->create();

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Private Form',
            'slug' => 'private-form',
            'status' => 'published',
        ]);

        Sanctum::actingAs($otherUser);
        $response = $this->getJson("/api/forms/{$form->id}/analytics");
        $response->assertStatus(403);
    }

    public function test_authenticated_user_can_view_analytics_for_their_own_form(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Feedback Form',
            'slug' => 'feedback-form',
            'status' => 'published',
            'draft_schema' => [
                'fields' => [
                    ['key' => 'f_name', 'label' => 'Name', 'type' => 'text'],
                    ['key' => 'f_email', 'label' => 'Email', 'type' => 'email'],
                ],
            ],
        ]);

        $response = $this->getJson("/api/forms/{$form->id}/analytics");
        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $response->assertJsonStructure([
            'success',
            'data' => [
                'funnel' => ['views', 'starts', 'completes', 'conversion_rate'],
                'dropoff',
                'daily',
            ],
        ]);
    }

    public function test_funnel_metrics_calculation(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Funnel Form',
            'slug' => 'funnel-form',
            'status' => 'published',
            'draft_schema' => [
                'fields' => [
                    ['key' => 'f_1', 'label' => 'Name', 'type' => 'text'],
                ],
            ],
        ]);

        // 10 distinct sessions view the form
        $sessions = [];
        for ($i = 1; $i <= 10; $i++) {
            $sid = (string) Str::uuid();
            $sessions[] = $sid;
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sid,
                'type' => 'view',
            ]);
        }

        // 5 of those sessions start the form
        for ($i = 0; $i < 5; $i++) {
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sessions[$i],
                'type' => 'start',
            ]);
        }

        // 3 of those sessions complete the form
        for ($i = 0; $i < 3; $i++) {
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sessions[$i],
                'type' => 'complete',
            ]);
        }

        $response = $this->getJson("/api/forms/{$form->id}/analytics");
        $response->assertStatus(200);

        $funnel = $response->json('data.funnel');
        $this->assertEquals(10, $funnel['views']);
        $this->assertEquals(5, $funnel['starts']);
        $this->assertEquals(3, $funnel['completes']);
        $this->assertEquals(60.0, $funnel['conversion_rate']);
    }

    public function test_per_field_dropoff_calculation(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Field Dropoff Form',
            'slug' => 'dropoff-form',
            'status' => 'published',
            'draft_schema' => [
                'fields' => [
                    ['key' => 'f_name', 'label' => 'Name', 'type' => 'text'],
                    ['key' => 'f_feedback', 'label' => 'Feedback', 'type' => 'text'],
                    ['key' => 'f_optional', 'label' => 'Optional', 'type' => 'text'],
                ],
            ],
        ]);

        $s1 = (string) Str::uuid();
        $s2 = (string) Str::uuid();
        $s3 = (string) Str::uuid();
        $s4 = (string) Str::uuid();
        $s5 = (string) Str::uuid();

        // 5 sessions interact with f_name (via field_focus or field_blur)
        foreach ([$s1, $s2, $s3, $s4, $s5] as $sid) {
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sid,
                'type' => 'field_focus',
                'field_key' => 'f_name',
            ]);
        }

        // 3 sessions interact with f_feedback (s1, s2, s3)
        foreach ([$s1, $s2, $s3] as $sid) {
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sid,
                'type' => 'field_blur',
                'field_key' => 'f_feedback',
            ]);
        }

        // Only s1 and s2 complete the form
        FormEvent::create(['form_id' => $form->id, 'session_id' => $s1, 'type' => 'complete']);
        FormEvent::create(['form_id' => $form->id, 'session_id' => $s2, 'type' => 'complete']);

        $response = $this->getJson("/api/forms/{$form->id}/analytics");
        $response->assertStatus(200);

        $dropoff = $response->json('data.dropoff');
        $this->assertCount(3, $dropoff);

        // f_name: 5 interactions, 3 dropouts (s3, s4, s5), drop_rate = (3/5)*100 = 60.0
        $this->assertEquals('f_name', $dropoff[0]['field_key']);
        $this->assertEquals('Name', $dropoff[0]['label']);
        $this->assertEquals('text', $dropoff[0]['type']);
        $this->assertEquals(5, $dropoff[0]['interactions']);
        $this->assertEquals(3, $dropoff[0]['dropouts']);
        $this->assertEquals(60.0, $dropoff[0]['drop_rate']);

        // f_feedback: 3 interactions (s1, s2, s3), 1 dropout (s3), drop_rate = (1/3)*100 = 33.33
        $this->assertEquals('f_feedback', $dropoff[1]['field_key']);
        $this->assertEquals('Feedback', $dropoff[1]['label']);
        $this->assertEquals(3, $dropoff[1]['interactions']);
        $this->assertEquals(1, $dropoff[1]['dropouts']);
        $this->assertEquals(33.33, $dropoff[1]['drop_rate']);

        // f_optional: 0 interactions, 0 dropouts, drop_rate = 0.0
        $this->assertEquals('f_optional', $dropoff[2]['field_key']);
        $this->assertEquals(0, $dropoff[2]['interactions']);
        $this->assertEquals(0, $dropoff[2]['dropouts']);
        $this->assertEquals(0.0, $dropoff[2]['drop_rate']);
    }

    public function test_field_interaction_detected_from_submission_answers(): void
    {
        [$user, $workspace] = $this->createWorkspaceAndUser();
        Sanctum::actingAs($user);

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Answer Test Form',
            'slug' => 'answer-test',
            'status' => 'published',
        ]);

        $version = FormVersion::create([
            'form_id' => $form->id,
            'version_no' => 1,
            'schema' => [
                'fields' => [
                    ['key' => 'f_title', 'label' => 'Title', 'type' => 'text'],
                ],
            ],
            'published_at' => now(),
        ]);
        $form->update(['current_version_id' => $version->id]);

        $sid = (string) Str::uuid();
        $sub = Submission::create([
            'form_id' => $form->id,
            'form_version_id' => $version->id,
            'session_id' => $sid,
            'status' => 'partial',
        ]);

        SubmissionAnswer::create([
            'submission_id' => $sub->id,
            'field_key' => 'f_title',
            'value' => 'Sample value',
        ]);

        $response = $this->getJson("/api/forms/{$form->id}/analytics");
        $response->assertStatus(200);

        $dropoff = $response->json('data.dropoff');
        $this->assertEquals(1, $dropoff[0]['interactions']);
        $this->assertEquals(1, $dropoff[0]['dropouts']);
        $this->assertEquals(100.0, $dropoff[0]['drop_rate']);
    }

    public function test_rollup_form_analytics_job_aggregates_events_into_daily_stats(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['owner_id' => $user->id, 'name' => 'W']);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Rollup Test',
            'slug' => 'rollup-test',
        ]);

        $date1 = '2026-09-17';
        $date2 = '2026-09-18';

        // Day 1 events: 4 views, 2 starts, 1 complete
        for ($i = 1; $i <= 4; $i++) {
            $sid = (string) Str::uuid();
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sid,
                'type' => 'view',
                'created_at' => "{$date1} 10:00:00",
            ]);
            if ($i <= 2) {
                FormEvent::create([
                    'form_id' => $form->id,
                    'session_id' => $sid,
                    'type' => 'start',
                    'created_at' => "{$date1} 10:05:00",
                ]);
            }
            if ($i === 1) {
                FormEvent::create([
                    'form_id' => $form->id,
                    'session_id' => $sid,
                    'type' => 'complete',
                    'created_at' => "{$date1} 10:10:00",
                ]);
            }
        }

        // Day 2 events: 2 views, 1 start, 1 complete
        for ($i = 1; $i <= 2; $i++) {
            $sid = (string) Str::uuid();
            FormEvent::create([
                'form_id' => $form->id,
                'session_id' => $sid,
                'type' => 'view',
                'created_at' => "{$date2} 11:00:00",
            ]);
            if ($i === 1) {
                FormEvent::create([
                    'form_id' => $form->id,
                    'session_id' => $sid,
                    'type' => 'start',
                    'created_at' => "{$date2} 11:05:00",
                ]);
                FormEvent::create([
                    'form_id' => $form->id,
                    'session_id' => $sid,
                    'type' => 'complete',
                    'created_at' => "{$date2} 11:10:00",
                ]);
            }
        }

        // Run the rollup job for the form
        RollupFormAnalyticsJob::dispatchSync($form->id);

        // Verify daily stats exist in database
        $this->assertDatabaseHas('form_daily_stats', [
            'form_id' => $form->id,
            'date' => $date1,
            'views' => 4,
            'starts' => 2,
            'completes' => 1,
        ]);

        $this->assertDatabaseHas('form_daily_stats', [
            'form_id' => $form->id,
            'date' => $date2,
            'views' => 2,
            'starts' => 1,
            'completes' => 1,
        ]);

        // Test upsert: add 1 more complete on Day 2 and re-run rollup
        $extraSid = (string) Str::uuid();
        FormEvent::create([
            'form_id' => $form->id,
            'session_id' => $extraSid,
            'type' => 'view',
            'created_at' => "{$date2} 12:00:00",
        ]);
        FormEvent::create([
            'form_id' => $form->id,
            'session_id' => $extraSid,
            'type' => 'complete',
            'created_at' => "{$date2} 12:10:00",
        ]);

        RollupFormAnalyticsJob::dispatchSync($form->id, $date2);

        $this->assertDatabaseHas('form_daily_stats', [
            'form_id' => $form->id,
            'date' => $date2,
            'views' => 3,
            'starts' => 1,
            'completes' => 2,
        ]);

        // Daily stats record count should still be 2 (one per date)
        $this->assertEquals(2, FormDailyStat::where('form_id', $form->id)->count());
    }
}
