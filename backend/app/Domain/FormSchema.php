<?php
// backend/app/Domain/FormSchema.php
namespace App\Domain;

class FormSchema
{
    /** @param array<int, array<string, mixed>> $fields */
    private function __construct(private readonly array $fields) {}

    public static function fromArray(array $data): self
    {
        if (!array_key_exists('fields', $data) || !is_array($data['fields'])) {
            throw new \InvalidArgumentException('Schema must contain a "fields" array.');
        }

        $seen = [];
        foreach ($data['fields'] as $f) {
            if (!isset($f['key']) || !is_string($f['key']) || $f['key'] === '') {
                throw new \InvalidArgumentException('Every field needs a non-empty string key.');
            }
            if (isset($seen[$f['key']])) {
                throw new \InvalidArgumentException("Duplicate field key: {$f['key']}");
            }
            $seen[$f['key']] = true;

            if (!isset($f['type']) || !is_string($f['type']) || FieldType::tryFrom($f['type']) === null) {
                throw new \InvalidArgumentException("Unknown field type: " . (is_scalar($f['type'] ?? null) ? $f['type'] : gettype($f['type'] ?? null)));
            }
            if (!isset($f['label']) || !is_string($f['label']) || trim($f['label']) === '') {
                throw new \InvalidArgumentException("Field {$f['key']} needs a non-empty label.");
            }
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
