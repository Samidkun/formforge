import { FIELD_LABELS } from './fieldTypes';
import type { Field, FieldType, Schema, SchemaAction } from './types';

export type { SchemaAction };

export const MAX_FIELDS = 50;

export function emptySchema(): Schema {
  return { fields: [] };
}

/** f_<n> dengan n = 1 + nomor tertinggi yang sudah dipakai (tidak menabrak f_3 saat f_2 dihapus). */
export function nextFieldKey(schema: Schema): string {
  let max = 0;
  for (const f of schema.fields) {
    const m = /^f_(\d+)$/.exec(f.key);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `f_${max + 1}`;
}

export function canAddField(schema: Schema): boolean {
  return schema.fields.length < MAX_FIELDS;
}

export function addField(schema: Schema, type: FieldType): Schema {
  if (!canAddField(schema)) return schema;
  const field: Field = { key: nextFieldKey(schema), type, label: FIELD_LABELS[type] };
  return { fields: [...schema.fields, field] };
}

export function schemaReducer(state: Schema, action: SchemaAction): Schema {
  switch (action.type) {
    case 'add_field':
      return addField(state, action.fieldType);

    case 'remove_field':
      return { fields: state.fields.filter((f) => f.key !== action.key) };

    case 'move_field': {
      const from = state.fields.findIndex((f) => f.key === action.key);
      if (from === -1) return { fields: [...state.fields] };
      const fields = [...state.fields];
      const [moved] = fields.splice(from, 1);
      const to = Math.max(0, Math.min(action.toIndex, fields.length));
      fields.splice(to, 0, moved);
      return { fields };
    }

    case 'update_field':
      return {
        fields: state.fields.map((f) =>
          f.key === action.key
            // key & type TIDAK bisa diubah lewat patch — hanya label/required.
            ? { ...f, label: action.patch.label ?? f.label, required: action.patch.required ?? f.required }
            : f
        ),
      };

    case 'set_options':
      return {
        fields: state.fields.map((f) =>
          f.key === action.key
            ? { ...f, options: action.options.map((o) => o.trim()).filter((o) => o !== '') }
            : f
        ),
      };

    case 'replace':
      return { fields: [...action.schema.fields] };
  }
}
