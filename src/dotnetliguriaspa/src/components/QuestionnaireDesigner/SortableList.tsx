import React, { FC, ReactNode } from 'react';
import { Box, IconButton } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableRow: FC<{ id: string; disabled?: boolean; label: string; children: ReactNode }> = ({ id, disabled, label, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <Box
      ref={setNodeRef}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: isDragging ? 0.6 : 1, transform: CSS.Transform.toString(transform), transition }}
    >
      <IconButton
        size="small"
        ref={setActivatorNodeRef}
        disabled={disabled}
        aria-label={`Trascina ${label}`}
        sx={{ cursor: disabled ? 'default' : 'grab', touchAction: 'none' }}
        {...attributes}
        {...listeners}
      >
        <DragIndicatorIcon fontSize="small" />
      </IconButton>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>{children}</Box>
    </Box>
  );
};

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  disabled?: boolean;
  itemLabel: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
}

function SortableList<T extends { id: string }>({ items, disabled, itemLabel, onReorder, renderItem }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex(i => i.id === active.id);
    const to = items.findIndex(i => i.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id} disabled={disabled} label={itemLabel(item)}>
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </Box>
      </SortableContext>
    </DndContext>
  );
}

export default SortableList;
