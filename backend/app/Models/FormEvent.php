<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FormEvent extends Model
{
    use HasFactory;

    public const UPDATED_AT = null;

    protected $table = 'form_events';

    protected $fillable = [
        'form_id',
        'session_id',
        'type',
        'field_key',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class);
    }
}
