<?php
// backend/app/Domain/FormSchema.php
namespace App\Domain;

class FormSchema
{
    /** @param array<int, array<string, mixed>> $fields */
    private function __construct(private readonly array $fields) {}

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function validate(array $data): array
    {
        if (!array_key_exists('fields', $data) || !is_array($data['fields'])) {
            return ['schema' => 'Schema must contain a "fields" array.'];
        }

        $errors = [];
        $seenKeys = [];
        $validOps = ['equals', 'not_equals', 'filled', 'empty', 'contains'];

        foreach ($data['fields'] as $index => $field) {
            if (!is_array($field)) {
                $errors["fields.{$index}"] = 'Field must be an array.';
                continue;
            }

            $key = $field['key'] ?? null;
            if (!is_string($key) || $key === '') {
                $errors["fields.{$index}.key"] = 'Every field needs a non-empty string key.';
                continue;
            }

            if (in_array($key, $seenKeys, true)) {
                $errors["fields.{$index}.key"] = "Duplicate field key: {$key}";
            }

            if (!isset($field['type']) || !is_string($field['type']) || FieldType::tryFrom($field['type']) === null) {
                $errors["fields.{$index}.type"] = "Unknown field type: " . (is_scalar($field['type'] ?? null) ? $field['type'] : gettype($field['type'] ?? null));
            }

            $label = $field['label'] ?? null;
            if (!is_string($label) || trim($label) === '') {
                $errors["fields.{$index}.label"] = "Field {$key} needs a non-empty label.";
            }

            if (isset($field['logic'])) {
                if (!is_array($field['logic']) || !isset($field['logic']['showIf']) || !is_array($field['logic']['showIf'])) {
                    $errors["fields.{$index}.logic"] = 'Logic must contain a valid showIf object.';
                } else {
                    $showIf = $field['logic']['showIf'];
                    $refField = $showIf['field'] ?? null;
                    $op = $showIf['op'] ?? null;

                    if (!$refField || !in_array($refField, $seenKeys, true)) {
                        $errors["fields.{$index}.logic"] = 'Conditional logic can only reference preceding fields in the form.';
                    } elseif (!$op || !in_array($op, $validOps, true)) {
                        $errors["fields.{$index}.logic"] = 'Invalid conditional logic operator.';
                    }
                }
            }

            $seenKeys[] = $key;
        }

        return $errors;
    }

    public static function fromArray(array $data): self
    {
        $errors = self::validate($data);
        if (!empty($errors)) {
            throw new \InvalidArgumentException(reset($errors));
        }

        return new self(array_values($data['fields']));
    }

    public function toArray(): array
    {
        return ['fields' => $this->fields];
    }

    /** @return array<int, string> */
    public function fieldKeys(): array
    {
        return array_map(fn ($f) => $f['key'], $this->fields);
    }

    /**
     * @param array<string, mixed> $answers
     * @return array<string, string> field_key => pesan error (kosong = valid)
     */
    public function validateAnswers(array $answers): array
    {
        $errors = [];
        foreach ($this->fields as $f) {
            $key   = $f['key'];
            $type  = FieldType::from($f['type']);
            $value = $answers[$key] ?? null;
            $empty = $value === null || $value === '' || $value === [];

            if ($empty) {
                if (!empty($f['required'])) {
                    $errors[$key] = 'Wajib diisi';
                }
                continue;
            }

            if ($type === FieldType::Email && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $errors[$key] = 'Format email tidak valid';
            }
            if ($type === FieldType::Number && !is_numeric($value)) {
                $errors[$key] = 'Harus berupa angka';
            }
            if ($type === FieldType::Rating) {
                $n = (int) $value;
                if ($n < 1 || $n > 5) { $errors[$key] = 'Rating harus 1-5'; }
            }
        }
        return $errors;
    }
}
