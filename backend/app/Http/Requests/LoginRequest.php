<?php
// backend/app/Http/Requests/LoginRequest.php
namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Envelope contract (plan Interfaces + spec 3.4 + ruling T5-1): validation
     * failures must return {success:false, error:{code,message}, meta:{}} with
     * HTTP 422, not Laravel's raw {message, errors} body. Same override pattern
     * as RegisterRequest::failedValidation().
     */
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
