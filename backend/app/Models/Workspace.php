<?php
// backend/app/Models/Workspace.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Workspace extends Model
{
    use HasUuids;
    protected $fillable = ['owner_id', 'name'];
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
}
