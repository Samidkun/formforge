<?php
// backend/app/Http/Requests/StoreFormRequest.php
namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class StoreFormRequest extends FormRequest
{
    public function authorize(): bool { return true; }   // auth:sanctum di route

    public function rules(): array
    {
        return ['title' => ['required', 'string', 'max:255']];
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
