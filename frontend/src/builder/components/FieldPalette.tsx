import { FIELD_TYPES, FIELD_LABELS } from '../fieldTypes';
import type { FieldType } from '../types';

export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <aside
      aria-label="Palet field"
      className="w-56 shrink-0 border-r border-[var(--color-border-hairline)] p-3"
    >
      <h2 className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        Field
      </h2>
      <ul className="flex flex-col gap-1">
        {FIELD_TYPES.map((t) => (
          <li key={t}>
            <button
              type="button"
              aria-label={`Tambah field ${FIELD_LABELS[t]}`}
              onClick={() => onAdd(t)}
              className="w-full rounded px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-primary)]"
            >
              {FIELD_LABELS[t]}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
