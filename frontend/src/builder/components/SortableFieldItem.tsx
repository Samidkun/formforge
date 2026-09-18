import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FIELD_LABELS } from '../fieldTypes';
import type { Field } from '../types';

interface SortableFieldItemProps {
  field: Field;
  isSelected: boolean;
  onSelect: (key: string) => void;
  onRemove: (key: string) => void;
}

export function SortableFieldItem({ field, isSelected, onSelect, onRemove }: SortableFieldItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(field.key)}
      className={`group flex items-center justify-between rounded border p-3 cursor-pointer transition-colors ${
        isSelected
          ? 'border-[var(--color-accent-primary)] bg-[var(--color-surface-elevated)]'
          : 'border-[var(--color-border-hairline)] bg-[var(--color-surface-primary)] hover:border-[var(--color-text-muted)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Pindahkan field ${field.label}`}
          className="cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-mono text-sm px-1 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          :::
        </button>
        <div>
          <div className="flex items-center gap-1.5 font-medium text-sm text-[var(--color-text-primary)]">
            <span>{field.label}</span>
            {field.required && <span className="text-[var(--color-accent-danger)]">*</span>}
          </div>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {FIELD_LABELS[field.type]} · {field.key}
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-label={`Hapus field ${field.key}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(field.key);
        }}
        className="opacity-0 group-hover:opacity-100 rounded px-2 py-1 text-xs text-[var(--color-accent-danger)] hover:bg-[var(--color-surface-primary)] transition-opacity"
      >
        Hapus
      </button>
    </div>
  );
}
