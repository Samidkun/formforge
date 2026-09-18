<?php
// backend/tests/Unit/FormSchemaTest.php
namespace Tests\Unit;

use App\Domain\FormSchema;
use PHPUnit\Framework\TestCase;

class FormSchemaTest extends TestCase
{
    private function validSchema(): array
    {
        return ['fields' => [
            ['key' => 'f_1', 'type' => 'text',  'label' => 'Nama',  'required' => true],
            ['key' => 'f_2', 'type' => 'email', 'label' => 'Email', 'required' => true],
            ['key' => 'f_3', 'type' => 'rating','label' => 'Nilai','required' => false],
        ]];
    }

    public function test_round_trip_is_lossless(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $this->assertSame($this->validSchema(), $s->toArray());
    }

    public function test_rejects_duplicate_field_keys(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => 'A', 'required' => true],
            ['key' => 'f_1', 'type' => 'text', 'label' => 'B', 'required' => true],
        ]]);
    }

    public function test_rejects_unknown_field_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'signature', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_requires_non_empty_label(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => '', 'required' => false],
        ]]);
    }

    public function test_required_field_missing_is_an_error(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $errors = $s->validateAnswers(['f_2' => 'a@b.com']);
        $this->assertArrayHasKey('f_1', $errors);
    }

    public function test_email_type_rejects_invalid_value(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $errors = $s->validateAnswers(['f_1' => 'Budi', 'f_2' => 'not-an-email']);
        $this->assertArrayHasKey('f_2', $errors);
    }

    public function test_valid_answers_produce_no_errors(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $this->assertSame([], $s->validateAnswers(['f_1' => 'Budi', 'f_2' => 'a@b.com']));
    }

    public function test_field_keys_are_listed_in_order(): void
    {
        $s = FormSchema::fromArray($this->validSchema());
        $this->assertSame(['f_1', 'f_2', 'f_3'], $s->fieldKeys());
    }

    public function test_rating_out_of_range_is_an_error(): void
    {
        $s = FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'rating', 'label' => 'Nilai', 'required' => false],
        ]]);
        $this->assertSame(['f_1' => 'Rating harus 1-5'], $s->validateAnswers(['f_1' => 9]));
        $this->assertSame(['f_1' => 'Rating harus 1-5'], $s->validateAnswers(['f_1' => 0]));
        $this->assertSame([], $s->validateAnswers(['f_1' => 1]));
        $this->assertSame([], $s->validateAnswers(['f_1' => 5]));
    }

    public function test_number_type_rejects_non_numeric_value(): void
    {
        $s = FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'number', 'label' => 'Jumlah', 'required' => false],
        ]]);
        $this->assertSame(['f_1' => 'Harus berupa angka'], $s->validateAnswers(['f_1' => 'abc']));
        $this->assertSame([], $s->validateAnswers(['f_1' => '7']));
    }

    public function test_error_messages_are_exact_strings(): void
    {
        $s = FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text',   'label' => 'Nama',   'required' => true],
            ['key' => 'f_2', 'type' => 'email',  'label' => 'Email',  'required' => false],
            ['key' => 'f_3', 'type' => 'number', 'label' => 'Jumlah', 'required' => false],
            ['key' => 'f_4', 'type' => 'rating', 'label' => 'Nilai',  'required' => false],
        ]]);
        $errors = $s->validateAnswers(['f_2' => 'nope', 'f_3' => 'abc', 'f_4' => 9]);
        $this->assertSame('Wajib diisi', $errors['f_1']);
        $this->assertSame('Format email tidak valid', $errors['f_2']);
        $this->assertSame('Harus berupa angka', $errors['f_3']);
        $this->assertSame('Rating harus 1-5', $errors['f_4']);
    }

    public function test_rejects_non_string_field_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => ['text'], 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_missing_or_non_array_fields(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray([]);
    }

    public function test_rejects_non_array_fields_value(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => 'nope']);
    }

    public function test_rejects_missing_field_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_empty_or_non_string_key(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => '', 'type' => 'text', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_whitespace_only_label(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => '   ', 'required' => false],
        ]]);
    }

    public function test_rejects_non_string_key(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 123, 'type' => 'text', 'label' => 'X', 'required' => false],
        ]]);
    }

    public function test_rejects_non_string_label(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        FormSchema::fromArray(['fields' => [
            ['key' => 'f_1', 'type' => 'text', 'label' => ['x'], 'required' => false],
        ]]);
    }

    public function test_validate_returns_empty_array_on_valid_schema(): void
    {
        $this->assertSame([], FormSchema::validate($this->validSchema()));
    }

    public function test_validate_returns_error_on_invalid_schema(): void
    {
        $errors = FormSchema::validate(['fields' => 'invalid']);
        $this->assertArrayHasKey('schema', $errors);
    }
}
