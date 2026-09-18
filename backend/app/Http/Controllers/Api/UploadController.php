<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Upload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class UploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file'          => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,svg,pdf,doc,docx,xls,xlsx,csv,txt,zip'],
            'form_id'       => ['nullable', 'uuid', 'exists:forms,id'],
            'submission_id' => ['nullable', 'uuid', 'exists:submissions,id'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error'   => [
                    'code'    => 'VALIDATION_ERROR',
                    'message' => $validator->errors()->first(),
                ],
                'meta'    => new \stdClass(),
            ], 422);
        }

        $file = $request->file('file');
        $path = $file->store('uploads', 'public');

        $upload = Upload::create([
            'form_id'       => $request->input('form_id'),
            'submission_id' => $request->input('submission_id'),
            'filename'      => $file->getClientOriginalName(),
            'mime'          => $file->getClientMimeType() ?: ($file->getMimeType() ?: 'application/octet-stream'),
            'size'          => $file->getSize(),
            'storage_path'  => $path,
        ]);

        return response()->json([
            'success' => true,
            'data'    => [
                'id'       => $upload->id,
                'filename' => $upload->filename,
                'mime'     => $upload->mime,
                'size'     => $upload->size,
                'url'      => Storage::url($path),
            ],
            'meta'    => new \stdClass(),
        ], 201);
    }
}
