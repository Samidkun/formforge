<?php
// backend/app/Http/Controllers/Api/FormController.php
namespace App\Http\Controllers\Api;

use App\Domain\FormSchema;
use App\Domain\FormSlug;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFormRequest;
use App\Http\Requests\UpdateFormRequest;
use App\Models\Form;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class FormController extends Controller
{
    private function envelope(array $data, int $status = 200)
    {
        return response()->json([
            'success' => $status < 400,
            'data'    => $data,
            'meta'    => new \stdClass(),
        ], $status);
    }

    private function error(string $code, string $message, int $status)
    {
        return response()->json([
            'success' => false,
            'error'   => ['code' => $code, 'message' => $message],
            'meta'    => new \stdClass(),
        ], $status);
    }

    public function index(Request $r)
    {
        $forms = Form::whereIn(
            'workspace_id',
            Workspace::where('owner_id', $r->user()->id)->pluck('id')
        )->orderByDesc('created_at')->orderByDesc('id')->get();

        return $this->envelope($forms->toArray());
    }

    public function store(StoreFormRequest $r)
    {
        $workspace = Workspace::where('owner_id', $r->user()->id)
            ->orderBy('created_at')->orderBy('id')->first();

        if (!$workspace) {
            return $this->error('NO_WORKSPACE', 'User tidak punya workspace.', 422);
        }

        $slug = FormSlug::resolve($r->title, fn ($s) => Form::where('slug', $s)->exists());

        $form = Form::create([
            'workspace_id' => $workspace->id,
            'title'        => $r->title,
            'slug'         => $slug,
        ]);

        return $this->envelope($form->fresh()->toArray(), 201);
    }

    public function show(Form $form)
    {
        Gate::authorize('view', $form);
        return $this->envelope($form->toArray());
    }

    public function update(UpdateFormRequest $r, Form $form)
    {
        Gate::authorize('update', $form);

        // draft_schema divalidasi oleh value object Plan 1 — bukan validasi tulis-ulang.
        if ($r->has('draft_schema')) {
            try {
                $schema = FormSchema::fromArray($r->input('draft_schema'));
            } catch (\InvalidArgumentException $e) {
                return $this->error('INVALID_SCHEMA', $e->getMessage(), 422);
            }
            $form->draft_schema = $schema->toArray();
        }

        if ($r->filled('title')) {
            $form->title = $r->title;
        }

        $form->save();

        return $this->envelope($form->fresh()->toArray());
    }

    public function destroy(Form $form)
    {
        Gate::authorize('delete', $form);
        $form->delete();
        return $this->envelope(['deleted' => true]);
    }
}
