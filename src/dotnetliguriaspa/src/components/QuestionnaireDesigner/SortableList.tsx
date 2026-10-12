import React, { ReactNode, useEffect, useRef } from 'react';
import {
  closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restoreMoveFocus } from '../../admin/pages/listKit';
import { dragAnnouncements, screenReaderInstructions } from './dragText';
import { Icon, miniIcon, MoveButtons } from './designerUi';

export interface RowControls {
  /** "Sposta su" / "Sposta giù" for this row: reorders and keeps the focus on the pressed button. */
  moveButtons: ReactNode;
}

const handleCls = `inline-grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full text-muted transition-colors hover:bg-cyan-50 hover:text-navy disabled:cursor-default disabled:opacity-35 pointer-coarse:size-11 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cyan-700`;

function SortableRow({ id, disabled, label, children }: { id: string; disabled?: boolean; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li ref={setNodeRef} className="flex items-start gap-0.5" style={{ opacity: isDragging ? 0.6 : 1, transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" ref={setActivatorNodeRef} disabled={disabled} aria-label={`Trascina: ${label}`} className={handleCls} {...attributes} {...listeners}>
        <Icon name="grip" />
      </button>
      <div className="flex min-w-0 flex-1 items-start gap-0.5">{children}</div>
    </li>
  );
}

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  /** Locked: rows can be edited but not reordered. */
  disabled?: boolean;
  itemLabel: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, controls: RowControls) => ReactNode;
}

/** Sortable rows: dnd-kit drag handle (pointer and keyboard) plus move up/down buttons for every row. */
function SortableList<T extends { id: string }>({ items, disabled, itemLabel, onReorder, renderItem }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const refocus = useRef<{ id: string; delta: -1 | 1 } | null>(null);

  // A reordered row is moved in the DOM and the browser drops focus: put it back on the button that was used.
  useEffect(() => {
    if (!refocus.current) return;
    restoreMoveFocus(refocus.current.id, refocus.current.delta);
    refocus.current = null;
  }, [items]);

  const labelOf = (id: string | number) => {
    const item = items.find(i => i.id === id);
    return item ? itemLabel(item) : 'elemento';
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex(i => i.id === active.id);
    const to = items.findIndex(i => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };
  const move = (index: number, delta: -1 | 1) => {
    refocus.current = { id: `i-${items[index].id}`, delta };
    onReorder(arrayMove(items, index, index + delta));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements: dragAnnouncements(labelOf), screenReaderInstructions }}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id} disabled={disabled} label={itemLabel(item)}>
              {renderItem(item, index, {
                moveButtons: (
                  <MoveButtons
                    id={`i-${item.id}`}
                    label={itemLabel(item)}
                    canUp={index > 0}
                    canDown={index < items.length - 1}
                    disabled={disabled}
                    onMove={delta => move(index, delta)}
                    className={miniIcon}
                  />
                ),
              })}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export default SortableList;
