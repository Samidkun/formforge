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
}
