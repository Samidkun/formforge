<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormDailyStat;
use App\Models\FormEvent;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class FormAnalyticsModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_form_has_events_and_daily_stats_relations(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'WS', 'owner_id' => $user->id]);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Analytics Test Form',
            'slug' => 'analytics-test',
        ]);

        $sessionId = (string) Str::uuid();

        $event = $form->events()->create([
            'session_id' => $sessionId,
            'type' => 'field_focus',
            'field_key' => 'email',
        ]);

        $daily = $form->dailyStats()->create([
            'date' => now()->toDateString(),
            'views' => 10,
            'starts' => 5,
            'completes' => 2,
        ]);

        $this->assertDatabaseHas('form_events', [
            'id' => $event->id,
            'form_id' => $form->id,
            'type' => 'field_focus',
            'field_key' => 'email',
        ]);

        $this->assertDatabaseHas('form_daily_stats', [
            'id' => $daily->id,
            'form_id' => $form->id,
            'views' => 10,
        ]);

        $this->assertCount(1, $form->events);
        $this->assertCount(1, $form->dailyStats);
        $this->assertTrue($event->form->is($form));
        $this->assertTrue($daily->form->is($form));
        $this->assertNotNull($event->created_at);
    }

    public function test_cascade_delete_removes_events_and_daily_stats(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'WS', 'owner_id' => $user->id]);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'To Delete',
            'slug' => 'to-delete',
        ]);

        $event = $form->events()->create([
            'session_id' => (string) Str::uuid(),
            'type' => 'view',
        ]);

        $daily = $form->dailyStats()->create([
            'date' => now()->toDateString(),
            'views' => 1,
        ]);

        $form->delete();

        $this->assertDatabaseMissing('form_events', ['id' => $event->id]);
        $this->assertDatabaseMissing('form_daily_stats', ['id' => $daily->id]);
    }

    public function test_form_daily_stats_date_is_unique_per_form(): void
    {
        $user = User::factory()->create();
        $workspace = Workspace::create(['name' => 'WS', 'owner_id' => $user->id]);
        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title' => 'Unique Date Test',
            'slug' => 'unique-date-test',
        ]);

        $today = now()->toDateString();
        $form->dailyStats()->create([
            'date' => $today,
            'views' => 1,
        ]);

        $this->expectException(QueryException::class);
        $form->dailyStats()->create([
            'date' => $today,
            'views' => 2,
        ]);
    }
}
