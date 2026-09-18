export type FieldType =
  | 'text' | 'email' | 'number' | 'long_text' | 'choice'
  | 'multi_choice' | 'rating' | 'date' | 'file';

export type Field = {
  key: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
};

export type Schema = { fields: Field[] };
