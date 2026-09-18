import { useState } from 'react';
import { FIELD_LABELS } from '../fieldTypes';
import type { Field } from '../types';

interface FieldConfigPanelProps {
  selectedField: Field | null;
  onUpdate: (key: string, patch: Partial<Pick<Field, 'label' | 'required'>>) => void;
  onSetOptions: (key: string, options: string[]) => void;
}

function FieldConfigForm({
  field,
  onUpdate,
  onSetOptions,
}: {
  field: Field;
  onUpdate: (key: string, patch: Partial<Pick<Field, 'label' | 'required'>>) => void;
  onSetOptions: (key: string, options: string[]) => void;
}) {
  const [prevLabel, setPrevLabel] = useState(field.label);
  const [label, setLabel] = useState(field.label);

  if (field.label !== prevLabel) {
    setPrevLabel(field.label);
    setLabel(field.label);
  }

  const [prevOptions, setPrevOptions] = useState(field.options);
  const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'));

  if (field.options !== prevOptions) {
    setPrevOptions(field.options);
    setOptionsText((field.options ?? []).join('\n'));
  }

  const isChoiceType = field.type === 'choice' || field.type === 'multi_choice';

  return (
    <aside
      aria-label="Panel Konfigurasi Field"
      className="w-72 shrink-0 border-l border-[var(--color-border-hairline)] p-4 text-sm flex flex-col gap-4 overflow-y-auto"
    >
      <div>
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Tipe Field</span>
        <div className="mt-1 font-mono text-xs text-[var(--color-accent-primary)] bg-[var(--color-surface-primary)] px-2 py-1 rounded inline-block">
          {FIELD_LABELS[field.type]} ({field.type})
        </div>
      </div>

      <div>
        <label htmlFor="field-label-input" className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          Label Field
        </label>
        <input
          id="field-label-input"
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            onUpdate(field.key, { label: e.target.value });
          }}
          className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="field-required-toggle"
          type="checkbox"
          checked={Boolean(field.required)}
          onChange={(e) => onUpdate(field.key, { required: e.target.checked })}
          className="rounded border-[var(--color-border-hairline)] accent-[var(--color-accent-primary)]"
        />
        <label htmlFor="field-required-toggle" className="text-sm select-none text-[var(--color-text-primary)]">
          Wajib diisi (required)
        </label>
      </div>

      {isChoiceType && (
        <div>
          <label htmlFor="field-options-input" className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            Opsi Pilihan (satu per baris)
          </label>
          <textarea
            id="field-options-input"
            rows={5}
            value={optionsText}
            onChange={(e) => {
              const val = e.target.value;
              setOptionsText(val);
              onSetOptions(field.key, val.split('\n'));
            }}
            placeholder="Opsi 1&#10;Opsi 2&#10;Opsi 3"
            className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
          />
        </div>
      )}

      <div className="mt-auto border-t border-[var(--color-border-hairline)] pt-3 text-xs text-[var(--color-text-muted)] font-mono">
        ID: {field.key}
      </div>
    </aside>
  );
}

export function FieldConfigPanel({ selectedField, onUpdate, onSetOptions }: FieldConfigPanelProps) {
  if (!selectedField) {
    return (
      <aside
        aria-label="Panel Konfigurasi Field"
        className="w-72 shrink-0 border-l border-[var(--color-border-hairline)] p-4 text-sm text-[var(--color-text-muted)]"
      >
        <p>Pilih field di kanvas untuk mengedit properti.</p>
      </aside>
    );
  }

  return (
    <FieldConfigForm
      key={selectedField.key}
      field={selectedField}
      onUpdate={onUpdate}
      onSetOptions={onSetOptions}
    />
  );
}
