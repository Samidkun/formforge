<?php

namespace App\Jobs;

use App\Models\FormDailyStat;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class RollupFormAnalyticsJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public ?string $formId = null,
        public ?string $date = null
    ) {}

    public function handle(): void
    {
        $query = DB::table('form_events')
            ->selectRaw("
                form_id,
                CAST(created_at AS DATE) as date,
                COUNT(DISTINCT CASE WHEN type = 'view' THEN session_id END) as views,
                COUNT(DISTINCT CASE WHEN type = 'start' THEN session_id END) as starts,
                COUNT(DISTINCT CASE WHEN type = 'complete' THEN session_id END) as completes
            ")
            ->groupBy('form_id', DB::raw('CAST(created_at AS DATE)'));

        if ($this->formId) {
            $query->where('form_id', $this->formId);
        }

        if ($this->date) {
            $query->whereDate('created_at', $this->date);
        }

        $rows = $query->get();

        $now = now();
        $records = [];
        foreach ($rows as $row) {
            $records[] = [
                'form_id' => $row->form_id,
                'date' => $row->date,
                'views' => (int) $row->views,
                'starts' => (int) $row->starts,
                'completes' => (int) $row->completes,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (!empty($records)) {
            FormDailyStat::upsert(
                $records,
                ['form_id', 'date'],
                ['views', 'starts', 'completes', 'updated_at']
            );
        }
    }
}
