<?php
// backend/tests/Unit/FormSlugTest.php
namespace Tests\Unit;

use App\Domain\FormSlug;
use PHPUnit\Framework\TestCase;

class FormSlugTest extends TestCase
{
    public function test_base_slugifies_title(): void
    {
        $this->assertSame('form-pendaftaran-2026', FormSlug::base('Form Pendaftaran 2026'));
    }

    public function test_base_strips_punctuation_and_collapses_separators(): void
    {
        $this->assertSame('halo-dunia', FormSlug::base('  Halo,   Dunia!!  '));
    }

    public function test_base_falls_back_when_title_has_no_usable_characters(): void
    {
        $this->assertSame('form', FormSlug::base('!!!'));
        $this->assertSame('form', FormSlug::base(''));
    }

    public function test_base_truncates_to_60_characters(): void
    {
        $this->assertSame(60, strlen(FormSlug::base(str_repeat('a', 200))));
    }

    public function test_resolve_returns_base_when_free(): void
    {
        $this->assertSame('toko-a', FormSlug::resolve('Toko A', fn ($s) => false));
    }

    public function test_resolve_appends_incrementing_suffix_when_taken(): void
    {
        $taken = ['toko-a', 'toko-a-2'];
        $this->assertSame('toko-a-3', FormSlug::resolve('Toko A', fn ($s) => in_array($s, $taken, true)));
    }
}
