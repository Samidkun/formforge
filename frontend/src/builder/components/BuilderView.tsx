'use client';

import { useReducer, useState } from 'react';
import { FieldPalette } from './FieldPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { FieldConfigPanel } from './FieldConfigPanel';
import { schemaReducer } from '../schema';
import type { Schema } from '../types';

interface BuilderViewProps {
  initialSchema: Schema;
  title: string;
  onSave?: (schema: Schema) => void;
}

export function BuilderView({ initialSchema, title, onSave }: BuilderViewProps) {
  const [schema, dispatch] = useReducer(schemaReducer, initialSchema);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedField = schema.fields.find((f) => f.key === selectedKey) ?? null;

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2 bg-[var(--color-surface-primary)]">
        <h1 className="text-sm font-semibold">{title}</h1>
        {onSave && (
          <button
            type="button"
            onClick={() => onSave(schema)}
            className="rounded bg-[var(--color-accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-primary)] hover:opacity-90 transition-opacity"
          >
            Simpan Draft
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <FieldPalette onAdd={(type) => dispatch({ type: 'add_field', fieldType: type })} />
        <BuilderCanvas
          schema={schema}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          onRemove={(key) => {
            dispatch({ type: 'remove_field', key });
            if (selectedKey === key) setSelectedKey(null);
          }}
          onMove={(key, toIndex) => dispatch({ type: 'move_field', key, toIndex })}
        />
        <FieldConfigPanel
          selectedField={selectedField}
          onUpdate={(key, patch) => dispatch({ type: 'update_field', key, patch })}
          onSetOptions={(key, options) => dispatch({ type: 'set_options', key, options })}
        />
      </div>
    </div>
  );
}
