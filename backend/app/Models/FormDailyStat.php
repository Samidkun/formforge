<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FormDailyStat extends Model
{
    use HasFactory;

    protected $table = 'form_daily_stats';

    protected $fillable = [
        'form_id',
        'date',
        'views',
        'starts',
        'completes',
    ];

    protected $casts = [
        'date' => 'date',
        'views' => 'integer',
        'starts' => 'integer',
        'completes' => 'integer',
    ];

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }
}
