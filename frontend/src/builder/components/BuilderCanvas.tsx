import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableFieldItem } from './SortableFieldItem';
import type { Schema } from '../types';

interface BuilderCanvasProps {
  schema: Schema;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, toIndex: number) => void;
}

export function BuilderCanvas({ schema, selectedKey, onSelect, onRemove, onMove }: BuilderCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const targetIndex = schema.fields.findIndex((f) => f.key === over.id);
      if (targetIndex !== -1) {
        onMove(String(active.id), targetIndex);
      }
    }
  };

  if (schema.fields.length === 0) {
    return (
      <section
        aria-label="Kanvas Form"
        className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[var(--color-text-muted)] border-2 border-dashed border-[var(--color-border-hairline)] m-4 rounded"
      >
        Tarik atau tambahkan field dari palet untuk mulai mendesain form.
      </section>
    );
  }

  return (
    <section
      aria-label="Kanvas Form"
      className="flex-1 overflow-y-auto p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelect(null);
        }
      }}
    >
      <div
        className="mx-auto max-w-xl flex flex-col gap-2.5"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelect(null);
          }
        }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={schema.fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
            {schema.fields.map((field) => (
              <SortableFieldItem
                key={field.key}
                field={field}
                isSelected={selectedKey === field.key}
                onSelect={(k) => onSelect(k)}
                onRemove={onRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}
