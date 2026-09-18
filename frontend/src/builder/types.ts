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

export type SchemaAction =
  | { type: 'add_field'; fieldType: FieldType }
  | { type: 'remove_field'; key: string }
  | { type: 'move_field'; key: string; toIndex: number }
  | { type: 'update_field'; key: string; patch: Partial<Pick<Field, 'label' | 'required'>> }
  | { type: 'set_options'; key: string; options: string[] }
  | { type: 'replace'; schema: Schema };
