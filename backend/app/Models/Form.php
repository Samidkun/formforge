<?php
// backend/app/Models/Form.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Form extends Model
{
    use HasUuids;

    protected $fillable = ['workspace_id', 'title', 'slug', 'status', 'draft_schema', 'settings'];

    protected $casts = [
        'draft_schema' => 'array',
        'settings'     => 'array',
    ];

    public function workspace(): BelongsTo { return $this->belongsTo(Workspace::class); }
}
