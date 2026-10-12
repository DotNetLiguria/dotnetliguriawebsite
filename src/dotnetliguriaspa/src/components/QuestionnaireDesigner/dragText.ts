import type { Announcements, ScreenReaderInstructions } from '@dnd-kit/core';

// dnd-kit speaks English by default: these are the Italian announcements and instructions for the drag handles.
// Dragging always has a pointer-only alternative as well (the "Sposta su" / "Sposta giù" buttons).

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable: 'Per prendere questo elemento premi Spazio o Invio. Poi usa le frecce per spostarlo e premi di nuovo Spazio o Invio per rilasciarlo, oppure Esc per annullare. In alternativa usa i pulsanti Sposta su e Sposta giù.',
};

/** `labelOf` turns a draggable or droppable id into a name a person would recognise. */
export const dragAnnouncements = (labelOf: (id: string | number) => string): Announcements => ({
  onDragStart: ({ active }) => `Hai preso: ${labelOf(active.id)}.`,
  onDragOver: ({ active, over }) => (over ? `${labelOf(active.id)} è sopra: ${labelOf(over.id)}.` : `${labelOf(active.id)} non è sopra una posizione valida.`),
  onDragEnd: ({ active, over }) => (over ? `${labelOf(active.id)} rilasciato su: ${labelOf(over.id)}.` : `${labelOf(active.id)} rilasciato.`),
  onDragCancel: ({ active }) => `Spostamento annullato: ${labelOf(active.id)} è rimasto dov'era.`,
});
