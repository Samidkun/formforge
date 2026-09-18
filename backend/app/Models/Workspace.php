<?php
// backend/app/Models/Workspace.php
namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workspace extends Model
{
    use HasUuids;
    protected $fillable = ['owner_id', 'name'];
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function forms(): HasMany { return $this->hasMany(Form::class); }
}
