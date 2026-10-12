import React, { useId, useState } from 'react';
import { Button, Dialog, Modal, ModalOverlay } from 'react-aria-components';
import { AdminIcon } from '../../admin/icons';
import { btn } from '../../admin/ui';
import { ModalHeader } from '../../admin/pages/listUi';
import SortableList from './SortableList';
import { FieldText, helpCls, errorCls, Icon, miniIcon } from './designerUi';
import { parseOptionLines } from '../../questionnaire/factory';
import { newId } from '../../questionnaire/rules';

export interface EditableItem { id: string; label: string; description?: string | null }

export interface ItemListEditorProps<T extends EditableItem> {
  items: T[];
  noun: string;
  /** Plural, lower case, for the group name ("opzioni"). */
  nounPlural: string;
  /** Structure locked: labels can change, items cannot be added, removed or reordered. */
  locked?: boolean;
  minItems?: number;
  withDescription?: boolean;
  /** Problem with the list as a whole; shown under it and linked to the group. */
  error?: string | null;
  onChange: (items: T[], coalesceKey?: string) => void;
}

function ItemListEditor<T extends EditableItem>({ items, noun, nounPlural, locked, minItems = 0, withDescription, error, onChange }: ItemListEditorProps<T>) {
  const errorId = useId();
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const update = (id: string, patch: Partial<EditableItem>, field: string) =>
    onChange(items.map(i => (i.id === id ? { ...i, ...patch } : i)), `item:${id}:${field}`);
  const insertAfter = (index: number) => {
    const item = { id: newId(), label: '' } as T;
    const next = [...items];
    next.splice(index + 1, 0, item);
    setFocusId(item.id);
    onChange(next);
  };
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));
  const paste = () => {
    const labels = parseOptionLines(pasteText, items.map(i => i.label));
    const cleaned = items.filter(i => i.label.trim());
    onChange([...cleaned, ...labels.map(label => ({ id: newId(), label }) as T)]);
    setPasteText('');
    setPasteOpen(false);
  };
  const pasteCount = parseOptionLines(pasteText, items.map(i => i.label)).length;

  return (
    <div role="group" aria-label={nounPlural} aria-describedby={error ? errorId : undefined} className="space-y-2">
      <SortableList
        items={items}
        disabled={locked}
        itemLabel={i => i.label || noun}
        onReorder={onChange}
        renderItem={(item, index, controls) => (
          <>
            <div className="min-w-0 flex-1 space-y-1">
              <FieldText
                aria-label={`${noun} ${index + 1}`}
                placeholder={`${noun} ${index + 1}`}
                value={item.label}
                autoFocus={item.id === focusId}
                maxLength={200}
                isInvalid={!!error && !item.label.trim()}
                onChange={label => update(item.id, { label }, 'label')}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !locked) { event.preventDefault(); insertAfter(index); }
                }}
                compact
              />
              {withDescription && (
                <FieldText
                  aria-label={`Descrizione ${noun.toLowerCase()} ${index + 1}`}
                  placeholder="Descrizione (es. speaker)"
                  value={item.description ?? ''}
                  onChange={description => update(item.id, { description: description || null }, 'description')}
                  compact
                />
              )}
            </div>
            {controls.moveButtons}
            <Button aria-label={`Elimina ${noun.toLowerCase()} ${index + 1}`} isDisabled={locked || items.length <= minItems} onPress={() => remove(item.id)} className={miniIcon}>
              <AdminIcon name="trash" />
            </Button>
          </>
        )}
      />
      {error && <p id={errorId} className={errorCls}>{error}</p>}
      {locked
        ? <p className={helpCls}>Il questionario ha già delle risposte: puoi correggere i testi, non aggiungere, togliere o riordinare.</p>
        : (
          <div className="flex flex-wrap gap-1">
            <Button onPress={() => insertAfter(items.length - 1)} className={btn.ghost}><AdminIcon name="plus" />Aggiungi</Button>
            <Button onPress={() => setPasteOpen(true)} className={btn.ghost}><Icon name="paste" />Incolla elenco</Button>
          </div>
        )}
      <ModalOverlay isOpen={pasteOpen} onOpenChange={setPasteOpen} isDismissable className="fixed inset-0 z-[55] flex bg-[rgb(0_36_69/0.42)] sm:items-center sm:justify-center sm:p-6">
        <Modal className="h-dvh w-full overflow-y-auto bg-white text-navy shadow-lift sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl">
          <Dialog aria-label="Incolla un elenco" className="outline-none">
            <ModalHeader title="Incolla un elenco" />
            <div className="space-y-4 p-5 sm:p-6">
              <FieldText
                label="Elenco da incollare"
                description="Una voce per riga. Elenchi puntati e numerati vengono ripuliti, i duplicati ignorati."
                multiline
                rows={7}
                autoFocus
                value={pasteText}
                onChange={setPasteText}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button slot="close" className={btn.ghost}>Annulla</Button>
                <Button isDisabled={pasteCount === 0} onPress={paste} className={btn.primary}>Aggiungi {pasteCount || ''}</Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}

export default ItemListEditor;
