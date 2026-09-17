<?php
// backend/app/Domain/FieldType.php
namespace App\Domain;

enum FieldType: string
{
    case Text = 'text';
    case Email = 'email';
    case Number = 'number';
    case LongText = 'long_text';
    case Choice = 'choice';
    case MultiChoice = 'multi_choice';
    case Rating = 'rating';
    case Date = 'date';
    case File = 'file';
}
