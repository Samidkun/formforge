'use client';

import { useState } from 'react';
import { FieldPalette } from './FieldPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { FieldConfigPanel } from './FieldConfigPanel';
import { canAddField, nextFieldKey } from '../schema';
import type { Schema, SchemaAction } from '../types';
import type { SaveStatus } from '../hooks/useFormBuilder';

interface BuilderViewProps {
  schema: Schema;
  dispatch: React.Dispatch<SchemaAction>;
  title: string;
  saveStatus?: SaveStatus;
  onSave?: () => void;
  isLoading?: boolean;
}

export function BuilderView({ schema, dispatch, title, saveStatus = 'idle', onSave, isLoading }: BuilderViewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedField = schema.fields.find((f) => f.key === selectedKey) ?? null;

  if (isLoading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] text-sm">
        Memuat form...
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border-hairline)] px-4 py-2 bg-[var(--color-surface-primary)]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">{title}</h1>
          {saveStatus === 'saving' && <span className="text-xs text-[var(--color-accent-warning)]">Menyimpan...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-[var(--color-accent-success)]">Draft tersimpan</span>}
          {saveStatus === 'error' && <span className="text-xs text-[var(--color-accent-danger)]">Gagal simpan</span>}
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            className="rounded bg-[var(--color-accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Simpan Draft
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <FieldPalette
          onAdd={(type) => {
            if (canAddField(schema)) {
              const newKey = nextFieldKey(schema);
              dispatch({ type: 'add_field', fieldType: type });
              setSelectedKey(newKey);
            }
          }}
        />
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
