<?php
// backend/app/Http/Requests/UpdateFormRequest.php
namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class UpdateFormRequest extends FormRequest
{
    public function authorize(): bool { return true; }   // ownership via Policy

    public function rules(): array
    {
        return [
            'title'        => ['sometimes', 'string', 'max:255'],
            'draft_schema' => ['sometimes', 'array'],
        ];
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'error'   => [
                'code'    => 'VALIDATION_ERROR',
                'message' => $validator->errors()->first(),
            ],
            'meta'    => new \stdClass(),
        ], 422));
    }
}
