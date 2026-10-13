import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

// Steps 9 (Materiali) and 10 (Foto): files from the file endpoint, the Aggiungi dialog (title and file, then
// Carica) and confirmed deletes, as in the previous admin.

const renderAt = (hash: string) => render(
  <>
    <Routes><Route path="/admin/workshop/:id" element={<EventDetailAdminPage />} /></Routes>
    <AdminToastRegion />
  </>,
  { route: `/admin/workshop/w1${hash}` },
);
const files = [
  { workshopFileId: 'f1', workshopId: 'w1', title: 'Slide Blazor', fileName: 'a1.pdf', fullPath: '/workshops/w001/tracks/a1.pdf', fileType: 4 },
  { workshopFileId: 'f2', workshopId: 'w1', title: 'Sala piena', fileName: 'p1.jpg', fullPath: '/workshops/w001/photos/p1.jpg', fileType: 2 },
];

beforeEach(() => adminToasts.clear());

describe('Materiali', () => {
  test('lists the materials, uploads one with a title through the Aggiungi dialog and deletes after confirmation', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('#materiali');
    const materials = await screen.findByRole('region', { name: 'Materiali' });
    // The file list arrives after the step renders.
    expect(await within(materials).findByText('Slide Blazor')).toBeInTheDocument();
    expect(within(materials).getByText('a1.pdf')).toBeInTheDocument();
    expect(within(materials).getByText('Tipo file: 4')).toBeInTheDocument();
    expect(within(materials).queryByText('Sala piena')).not.toBeInTheDocument();
    expect(api.to('/workshopfile/w1', 'GET')).toHaveLength(1);

    await user.click(within(materials).getByRole('button', { name: 'Aggiungi' }));
    const form = await screen.findByRole('dialog', { name: 'Aggiungi materiale' });
    expect(within(form).getByRole('button', { name: 'Carica' })).toBeDisabled();
    expect(within(form).getByRole('textbox', { name: 'Titolo' })).toHaveAttribute('placeholder', 'Titolo del materiale');
    expect(within(form).getByRole('button', { name: 'Scegli file…' })).toHaveAccessibleDescription('File *');
    await user.type(within(form).getByRole('textbox', { name: 'Titolo' }), 'Demo .NET Aspire');
    expect(within(form).getByRole('button', { name: 'Carica' })).toBeDisabled();
    const input = form.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'aspire.pdf', { type: 'application/pdf' })] } });
    expect(within(form).getByRole('button', { name: 'aspire.pdf' })).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Carica' }));
    await waitFor(() => expect(api.to('/workshopfile/Upload', 'POST')).toHaveLength(1));
    const formData = api.to('/workshopfile/Upload')[0].form!;
    expect(formData.get('workshopId')).toBe('w1');
    expect(formData.get('fileType')).toBe('4');
    expect(formData.get('title')).toBe('Demo .NET Aspire');
    expect((formData.get('file') as File).name).toBe('aspire.pdf');
    expect(await screen.findByText('Materiale caricato correttamente')).toBeInTheDocument();
    await waitFor(() => expect(api.to('/workshopfile/w1', 'GET')).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Aggiungi materiale' })).not.toBeInTheDocument());

    await user.click(await within(materials).findByRole('button', { name: 'Elimina: Slide Blazor' }));
    expect(within(materials).getByRole('alert')).toHaveTextContent('Vuoi davvero eliminare questo materiale?');
    expect(api.to('/workshopfile/f1', 'DELETE')).toHaveLength(0);
    await user.click(within(materials).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(api.to('/workshopfile/f1', 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(within(materials).queryByText('Slide Blazor')).not.toBeInTheDocument());
    expect(await screen.findByText('Materiale eliminato correttamente')).toBeInTheDocument();
    expect(within(materials).getByText('Nessun materiale disponibile.')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('closes the dialog with Annulla and reports a failed delete with the previous fixed message', async () => {
    const user = userEvent.setup();
    serveEvent(eventFixture(), { '/workshopfile/f1': () => jsonResponse({ detail: 'Locked' }, 409) }, { files });
    renderAt('#materiali');
    const materials = await screen.findByRole('region', { name: 'Materiali' });
    await user.click(within(materials).getByRole('button', { name: 'Aggiungi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Aggiungi materiale' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Titolo' }), 'Bozza');
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(within(materials).getByRole('button', { name: 'Aggiungi' }));
    expect(within(await screen.findByRole('dialog', { name: 'Aggiungi materiale' })).getByRole('textbox', { name: 'Titolo' })).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(await within(materials).findByRole('button', { name: 'Elimina: Slide Blazor' }));
    await user.click(within(materials).getByRole('button', { name: 'OK' }));
    expect(await screen.findByText("Errore nell'eliminazione del materiale")).toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    expect(within(materials).getByText('Slide Blazor')).toBeInTheDocument();
  });

  test('leaves the list empty when the file endpoint fails, as before', async () => {
    serveEvent(eventFixture(), { '/workshopfile/w1': () => jsonResponse({}, 500) });
    renderAt('#materiali');
    const materials = await screen.findByRole('region', { name: 'Materiali' });
    expect(await within(materials).findByText('Nessun materiale disponibile.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });
});

describe('Foto', () => {
  test('shows the photos from /Contents, uploads them as photos with a title and lets a delete be cancelled', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('#foto');
    const photos = await screen.findByRole('region', { name: 'Foto' });
    expect(await within(photos).findByRole('img', { name: 'Sala piena' })).toHaveAttribute('src', contentUrl('/workshops/w001/photos/p1.jpg'));
    expect(within(photos).queryByText('Slide Blazor')).not.toBeInTheDocument();

    await user.click(within(photos).getByRole('button', { name: 'Aggiungi' }));
    const form = await screen.findByRole('dialog', { name: 'Aggiungi foto' });
    expect(within(form).getByRole('textbox', { name: 'Titolo' })).toHaveAttribute('placeholder', 'Titolo della foto');
    expect(form.querySelector('input[type="file"]')).toHaveAttribute('accept', 'image/*');
    await user.type(within(form).getByRole('textbox', { name: 'Titolo' }), 'Gruppo');
    fireEvent.change(form.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['img'], 'gruppo.jpg', { type: 'image/jpeg' })] } });
    await user.click(within(form).getByRole('button', { name: 'Carica' }));
    await waitFor(() => expect(api.to('/workshopfile/Upload', 'POST')).toHaveLength(1));
    expect(api.to('/workshopfile/Upload')[0].form!.get('fileType')).toBe('2');
    expect(api.to('/workshopfile/Upload')[0].form!.get('title')).toBe('Gruppo');
    expect(await screen.findByText('Foto caricata correttamente')).toBeInTheDocument();

    await user.click(within(photos).getByRole('button', { name: 'Elimina: Sala piena' }));
    expect(within(photos).getByRole('alert')).toHaveTextContent('Vuoi davvero eliminare questa foto?');
    await user.click(within(photos).getByRole('button', { name: 'Annulla' }));
    expect(api.to('/workshopfile/f2', 'DELETE')).toHaveLength(0);
    expect(within(photos).getByRole('img', { name: 'Sala piena' })).toBeInTheDocument();
  });

  test('shows "Immagine non trovata" when a photo does not load or has no file, as before', async () => {
    serveEvent(eventFixture(), {}, { files: [...files, { workshopFileId: 'f3', workshopId: 'w1', title: 'Senza file', fileName: 'p2.jpg', fullPath: null, fileType: 2 }] });
    renderAt('#foto');
    const photos = await screen.findByRole('region', { name: 'Foto' });
    expect(await within(photos).findAllByRole('img', { name: 'Immagine non trovata' })).toHaveLength(1);
    fireEvent.error(within(photos).getByRole('img', { name: 'Sala piena' }));
    expect(within(photos).getAllByRole('img', { name: 'Immagine non trovata' })).toHaveLength(2);
    expect(within(photos).getAllByText('Immagine non trovata')).toHaveLength(2);
  });

  test('ends the wizard with "Salva modifiche", which sends the whole record even when nothing changed, as before', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('#foto');
    await screen.findByRole('region', { name: 'Foto' });
    expect(screen.queryByRole('button', { name: /^Avanti/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()).toMatchObject({ title: 'Test Workshop', published: true, location: { name: 'Genova' } });
    expect(await screen.findByText('Evento aggiornato correttamente')).toBeInTheDocument();
  });
});
