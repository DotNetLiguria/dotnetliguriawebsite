import React, { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '../../test-utils';
import { EventCombobox, MarkdownEditor } from './editorUi';

test('event selection is a dropdown with the single current event, not a free-text field', async () => {
  const onChange = vi.fn();
  render(<EventCombobox events={[{ id: 'current', title: 'Evento corrente', date: '2026-11-01', locationName: 'Genova' }]} value="" onChange={onChange} />);
  const select = screen.getByRole('combobox', { name: 'Evento pubblicato in corso o futuro' });
  expect(select.tagName).toBe('SELECT');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Evento corrente · 2026-11-01 · Genova/ })).toBeInTheDocument();
  await userEvent.setup({ delay: null }).selectOptions(select, 'current');
  expect(onChange).toHaveBeenCalledWith('current');
});

test('no eligible events is explicit and cannot accept arbitrary input', () => {
  render(<EventCombobox events={[]} value="" onChange={vi.fn()} />);
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('option', { name: 'Nessun evento disponibile' })).toBeInTheDocument();
});

function Editor({ readOnly = false, disabled = false }: { readOnly?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState('Testo da formattare');
  return <MarkdownEditor value={value} onChange={setValue} readOnly={readOnly} disabled={disabled} />;
}

test('icon toolbar formats the selected text, restores focus and toggles formatting', async () => {
  render(<Editor />);
  const user = userEvent.setup({ delay: null });
  expect(screen.getByRole('toolbar', { name: 'Formattazione testo' })).toBeInTheDocument();
  const editor = screen.getByRole('textbox', { name: 'Contenuto Markdown' }) as HTMLTextAreaElement;
  editor.focus();
  editor.setSelectionRange(0, 5);
  await user.click(screen.getByRole('button', { name: 'Grassetto' }));
  expect(editor).toHaveValue('**Testo** da formattare');
  expect(editor).toHaveFocus();
  expect(editor.selectionStart).toBe(2);
  expect(editor.selectionEnd).toBe(7);
  await user.click(screen.getByRole('button', { name: 'Grassetto' }));
  expect(editor).toHaveValue('Testo da formattare');
  await user.keyboard('{Control>}i{/Control}');
  expect(editor).toHaveValue('_Testo_ da formattare');
});

test('formatting toolbar supports arrow-key navigation and disables edits while busy', async () => {
  const view = render(<Editor />);
  const user = userEvent.setup({ delay: null });
  screen.getByRole('button', { name: 'Grassetto' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('button', { name: 'Corsivo' })).toHaveFocus();
  view.rerender(<Editor disabled />);
  expect(screen.getByRole('button', { name: 'Grassetto' })).toBeDisabled();
  expect(screen.getByRole('textbox')).toBeDisabled();
  view.rerender(<Editor readOnly />);
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
});
