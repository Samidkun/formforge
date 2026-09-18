import { useState } from 'react';
import { FIELD_LABELS } from '../fieldTypes';
import { getAvailableTriggerFields } from '../logic';
import type { Field, FieldLogic, FormField, LogicOperator } from '../types';

export type FieldConfigAction =
  | { type: 'UPDATE_FIELD'; payload: { key: string; field: FormField } }
  | { type: string; [key: string]: unknown };

export interface FieldConfigPanelProps {
  selectedField?: Field | null;
  field?: Field | null;
  allFields?: FormField[];
  onUpdate?: (key: string, patch: Partial<Pick<Field, 'label' | 'required'>>) => void;
  onSetOptions?: (key: string, options: string[]) => void;
  dispatch?: (action: FieldConfigAction) => void;
}

function FieldConfigForm({
  field,
  allFields = [],
  onUpdate,
  onSetOptions,
  dispatch,
}: {
  field: Field;
  allFields?: FormField[];
  onUpdate?: (key: string, patch: Partial<Pick<Field, 'label' | 'required'>>) => void;
  onSetOptions?: (key: string, options: string[]) => void;
  dispatch?: (action: FieldConfigAction) => void;
}) {
  const [prevKey, setPrevKey] = useState(field.key);
  const [prevLabel, setPrevLabel] = useState(field.label);
  const [label, setLabel] = useState(field.label);
  const [optionsText, setOptionsText] = useState((field.options ?? []).join('\n'));

  const [logicState, setLogicState] = useState<FieldLogic | undefined>(field.logic);
  const [prevLogic, setPrevLogic] = useState(field.logic);

  if (field.key !== prevKey) {
    setPrevKey(field.key);
    setPrevLabel(field.label);
    setLabel(field.label);
    setOptionsText((field.options ?? []).join('\n'));
    setPrevLogic(field.logic);
    setLogicState(field.logic);
  } else if (field.label !== prevLabel) {
    setPrevLabel(field.label);
    setLabel(field.label);
  } else if (field.logic !== prevLogic) {
    setPrevLogic(field.logic);
    setLogicState(field.logic);
  }

  const isChoiceType = field.type === 'choice' || field.type === 'multi_choice';
  const availableTriggers = getAvailableTriggerFields(allFields, field.key);
  const hasTriggers = availableTriggers.length > 0;

  const isLogicEnabled = Boolean(logicState?.showIf);
  const currentTriggerKey = logicState?.showIf?.field || (availableTriggers[0]?.key ?? '');
  const currentOp = (logicState?.showIf?.op as LogicOperator) || 'equals';
  const currentValue = logicState?.showIf?.value ?? '';
  const isValueHidden = currentOp === 'filled' || currentOp === 'empty';
  const currentTriggerField = availableTriggers.find((t) => t.key === currentTriggerKey);
  const triggerOptions = currentTriggerField?.options ?? [];
  const hasTriggerOptions = triggerOptions.length > 0;

  const emitLogicChange = (newLogic: FieldLogic | undefined) => {
    const updatedField: FormField = {
      ...field,
      logic: newLogic,
    };
    if (dispatch) {
      dispatch({
        type: 'UPDATE_FIELD',
        payload: {
          key: field.key,
          field: updatedField,
        },
      });
    }
  };

  const handleToggleLogic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      const defaultTrigger = availableTriggers[0]?.key ?? '';
      const triggerField = availableTriggers.find((t) => t.key === defaultTrigger);
      const defaultVal = triggerField?.options && triggerField.options.length > 0 ? triggerField.options[0] : '';
      const newLogic: FieldLogic = {
        showIf: {
          field: defaultTrigger,
          op: 'equals',
          value: defaultVal,
        },
      };
      setLogicState(newLogic);
      emitLogicChange(newLogic);
    } else {
      setLogicState(undefined);
      emitLogicChange(undefined);
    }
  };

  const handleTriggerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTriggerKey = e.target.value;
    const triggerField = availableTriggers.find((t) => t.key === newTriggerKey);
    const newVal = triggerField?.options && triggerField.options.length > 0 ? triggerField.options[0] : '';
    const newLogic: FieldLogic = {
      showIf: {
        field: newTriggerKey,
        op: currentOp,
        value: isValueHidden ? undefined : (newVal || currentValue),
      },
    };
    setLogicState(newLogic);
    emitLogicChange(newLogic);
  };

  const handleOpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOp = e.target.value as LogicOperator;
    const isHidden = newOp === 'filled' || newOp === 'empty';
    const newLogic: FieldLogic = {
      showIf: {
        field: currentTriggerKey,
        op: newOp,
        value: isHidden ? undefined : currentValue,
      },
    };
    setLogicState(newLogic);
    emitLogicChange(newLogic);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newVal = e.target.value;
    const newLogic: FieldLogic = {
      showIf: {
        field: currentTriggerKey,
        op: currentOp,
        value: newVal,
      },
    };
    setLogicState(newLogic);
    emitLogicChange(newLogic);
  };

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
            onUpdate?.(field.key, { label: e.target.value });
          }}
          className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="field-required-toggle"
          type="checkbox"
          checked={Boolean(field.required)}
          onChange={(e) => onUpdate?.(field.key, { required: e.target.checked })}
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
              onSetOptions?.(field.key, val.split('\n'));
            }}
            placeholder="Opsi 1&#10;Opsi 2&#10;Opsi 3"
            className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
          />
        </div>
      )}

      {hasTriggers && (
        <div className="border-t border-[var(--color-border-hairline)] pt-3 flex flex-col gap-3">
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Syarat Tampil (Conditional Logic)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="field-logic-enable"
              type="checkbox"
              checked={isLogicEnabled}
              onChange={handleToggleLogic}
              className="rounded border-[var(--color-border-hairline)] accent-[var(--color-accent-primary)]"
            />
            <label htmlFor="field-logic-enable" className="text-sm select-none text-[var(--color-text-primary)]">
              Aktifkan syarat tampil
            </label>
          </div>

          {isLogicEnabled && (
            <div className="flex flex-col gap-3 rounded bg-[var(--color-surface-elevated)] p-2.5 border border-[var(--color-border-hairline)]">
              <div>
                <label
                  htmlFor="field-logic-trigger"
                  className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1"
                >
                  Field Pemicu
                </label>
                <select
                  id="field-logic-trigger"
                  aria-label="Field Pemicu"
                  value={currentTriggerKey}
                  onChange={handleTriggerChange}
                  className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
                >
                  {availableTriggers.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label} ({t.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="field-logic-operator"
                  className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1"
                >
                  Operator
                </label>
                <select
                  id="field-logic-operator"
                  aria-label="Operator"
                  value={currentOp}
                  onChange={handleOpChange}
                  className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
                >
                  <option value="equals">Sama dengan (equals)</option>
                  <option value="not_equals">Tidak sama dengan (not_equals)</option>
                  <option value="filled">Terisi (filled)</option>
                  <option value="empty">Kosong (empty)</option>
                  <option value="contains">Mengandung (contains)</option>
                </select>
              </div>

              {!isValueHidden && (
                <div>
                  <label
                    htmlFor="field-logic-value"
                    className="block text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-1"
                  >
                    Nilai Acuan
                  </label>
                  {hasTriggerOptions ? (
                    <select
                      id="field-logic-value"
                      aria-label="Nilai Acuan"
                      value={String(currentValue)}
                      onChange={handleValueChange}
                      className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
                    >
                      <option value="">-- Pilih Nilai --</option>
                      {triggerOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="field-logic-value"
                      aria-label="Nilai Acuan"
                      type="text"
                      value={String(currentValue)}
                      onChange={handleValueChange}
                      placeholder="Masukkan nilai acuan..."
                      className="w-full rounded border border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-auto border-t border-[var(--color-border-hairline)] pt-3 text-xs text-[var(--color-text-muted)] font-mono">
        ID: {field.key}
      </div>
    </aside>
  );
}

export function FieldConfigPanel({
  selectedField,
  field,
  allFields,
  onUpdate,
  onSetOptions,
  dispatch,
}: FieldConfigPanelProps) {
  const activeField = field !== undefined ? field : (selectedField ?? null);

  if (!activeField) {
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
      key={activeField.key}
      field={activeField}
      allFields={allFields}
      onUpdate={onUpdate}
      onSetOptions={onSetOptions}
      dispatch={dispatch}
    />
  );
}
