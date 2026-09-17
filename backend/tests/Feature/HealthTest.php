<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_endpoint_reports_db_and_cache(): void
    {
        $res = $this->getJson('/api/health');
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.db', 'ok')
            ->assertJsonPath('data.cache', 'ok');
    }
}
