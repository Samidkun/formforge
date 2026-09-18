import type { FieldType } from './types';

/** Urut sesuai spec §2.3 (9 field type) — dipakai palette & config panel. */
export const FIELD_TYPES = [
  'text', 'email', 'number', 'long_text', 'choice',
  'multi_choice', 'rating', 'date', 'file',
] as const satisfies readonly FieldType[];

export const FIELD_LABELS: Record<FieldType, string> = {
  text: 'Teks Singkat',
  email: 'Email',
  number: 'Angka',
  long_text: 'Teks Panjang',
  choice: 'Pilihan Tunggal',
  multi_choice: 'Pilihan Ganda',
  rating: 'Rating',
  date: 'Tanggal',
  file: 'Unggah Berkas',
};
