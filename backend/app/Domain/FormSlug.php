<?php
// backend/app/Domain/FormSlug.php
namespace App\Domain;

final class FormSlug
{
    public static function base(string $title): string
    {
        $s = strtolower(trim($title));
        $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
        $s = trim($s, '-');
        if ($s === '') {
            $s = 'form';
        }
        return substr($s, 0, 60);
    }

    /** @param callable(string): bool $taken */
    public static function resolve(string $title, callable $taken): string
    {
        $base = self::base($title);
        if (!$taken($base)) {
            return $base;
        }
        $n = 2;
        while ($taken($base . '-' . $n)) {
            $n++;
        }
        return $base . '-' . $n;
    }
}
