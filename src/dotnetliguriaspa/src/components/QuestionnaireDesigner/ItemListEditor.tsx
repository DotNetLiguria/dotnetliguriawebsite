import React, { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SortableList from './SortableList';
import { parseOptionLines } from '../../questionnaire/factory';
import { newId } from '../../questionnaire/rules';

export interface EditableItem { id: string; label: string; description?: string | null }

export interface ItemListEditorProps<T extends EditableItem> {
  items: T[];
  noun: string;
  /** Structure locked: labels can change, items cannot be added, removed or reordered. */
  locked?: boolean;
  minItems?: number;
  withDescription?: boolean;
  onChange: (items: T[], coalesceKey?: string) => void;
}

function ItemListEditor<T extends EditableItem>({ items, noun, locked, minItems = 0, withDescription, onChange }: ItemListEditorProps<T>) {
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
    <Stack spacing={1}>
      <SortableList
        items={items}
        disabled={locked}
        itemLabel={i => i.label || noun}
        onReorder={onChange}
        renderItem={(item, index) => (
          <>
            <Stack sx={{ flex: 1 }} spacing={0.5}>
              <TextField
                size="small"
                fullWidth
                placeholder={`${noun} ${index + 1}`}
                value={item.label}
                autoFocus={item.id === focusId}
                onChange={e => update(item.id, { label: e.target.value }, 'label')}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !locked) { e.preventDefault(); insertAfter(index); }
                }}
                slotProps={{ htmlInput: { 'aria-label': `${noun} ${index + 1}`, maxLength: 200 } }}
              />
              {withDescription && (
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Descrizione (es. speaker)"
                  value={item.description ?? ''}
                  onChange={e => update(item.id, { description: e.target.value || null }, 'description')}
                  slotProps={{ htmlInput: { 'aria-label': `Descrizione ${noun.toLowerCase()} ${index + 1}` } }}
                />
              )}
            </Stack>
            <Tooltip title={`Elimina ${noun.toLowerCase()}`}>
              <span>
                <IconButton size="small" aria-label={`Elimina ${noun.toLowerCase()} ${index + 1}`}
                  disabled={locked || items.length <= minItems} onClick={() => remove(item.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
      />
      {!locked && (
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => insertAfter(items.length - 1)}>Aggiungi</Button>
          <Button size="small" startIcon={<ContentPasteIcon />} onClick={() => setPasteOpen(true)}>Incolla elenco</Button>
        </Stack>
      )}
      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Incolla un elenco</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Una voce per riga. Elenchi puntati e numerati vengono ripuliti, i duplicati ignorati.
          </Typography>
          <TextField autoFocus multiline minRows={6} fullWidth value={pasteText} onChange={e => setPasteText(e.target.value)}
            slotProps={{ htmlInput: { 'aria-label': 'Elenco da incollare' } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasteOpen(false)}>Annulla</Button>
          <Button variant="contained" disabled={pasteCount === 0} onClick={paste}>Aggiungi {pasteCount || ''}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ItemListEditor;
