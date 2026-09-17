<?php
// backend/app/Http/Requests/RegisterRequest.php
namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }

    /**
     * Envelope contract (plan Interfaces + spec 3.4): every endpoint returns
     * {success, data|error, meta}. Laravel's default ValidationException body is
     * {message, errors} with no `success` key, which would break the envelope.
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
