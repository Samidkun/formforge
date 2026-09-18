<?php
// backend/app/Models/Form.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Form extends Model
{
    use HasUuids;

    protected $fillable = ['workspace_id', 'title', 'slug', 'status', 'draft_schema', 'settings', 'current_version_id'];

    protected $casts = [
        'draft_schema' => 'array',
        'settings'     => 'array',
    ];

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function formVersions(): HasMany
    {
        return $this->hasMany(FormVersion::class);
    }

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(FormVersion::class, 'current_version_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(FormEvent::class);
    }

    public function dailyStats(): HasMany
    {
        return $this->hasMany(FormDailyStat::class);
    }
}
