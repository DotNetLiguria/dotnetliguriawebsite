import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import { contentUrl } from '../../site/siteApi';
import EventDetailAdminPage from './EventDetailAdminPage';
import { eventFixture, serveEvent } from './eventFixtures';

// Steps 9 (Materiali) and 10 (Foto): files from the file endpoint, immediate uploads and confirmed deletes.

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
  test('lists the materials, uploads as multipart with an optional title and deletes after confirmation', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('#materiali');
    const materials = await screen.findByRole('region', { name: 'Slide e materiali' });
    expect(within(materials).getByText('Slide Blazor')).toBeInTheDocument();
    expect(within(materials).queryByText('Sala piena')).not.toBeInTheDocument();
    expect(within(materials).getByRole('link', { name: /Apri Slide Blazor/ })).toHaveAttribute('href', contentUrl('/workshops/w001/tracks/a1.pdf'));
    expect(api.to('/workshopfile/w1', 'GET')).toHaveLength(1);

    await user.type(within(materials).getByRole('textbox', { name: 'Titolo del materiale' }), 'Demo .NET Aspire');
    const input = materials.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'aspire.pdf', { type: 'application/pdf' }), new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(api.to('/workshopfile/Upload', 'POST')).toHaveLength(1));
    const form = api.to('/workshopfile/Upload')[0].form!;
    expect(form.get('workshopId')).toBe('w1');
    expect(form.get('fileType')).toBe('4');
    expect(form.get('title')).toBe('Demo .NET Aspire');
    expect((form.get('file') as File).name).toBe('aspire.pdf');
    expect(await screen.findByText('1 file caricato')).toBeInTheDocument();
    expect(screen.getByText('Non caricati: notes.txt: formato non ammesso.')).toBeInTheDocument();
    await waitFor(() => expect(api.to('/workshopfile/w1', 'GET')).toHaveLength(2));
    await waitFor(() => expect(within(materials).getByRole('textbox', { name: 'Titolo del materiale' })).toHaveValue(''));

    await user.click(within(materials).getByRole('button', { name: 'Elimina: Slide Blazor' }));
    expect(within(materials).getByRole('alert')).toHaveTextContent('Eliminare «Slide Blazor»?');
    expect(api.to('/workshopfile/f1', 'DELETE')).toHaveLength(0);
    await user.click(within(materials).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(api.to('/workshopfile/f1', 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(within(materials).queryByText('Slide Blazor')).not.toBeInTheDocument());
    expect(await screen.findByText('File eliminato')).toBeInTheDocument();
    expect(api.to('/Workshop/Update/')).toHaveLength(0);
  });

  test('reports a failed file load with a retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    serveEvent(eventFixture(), { '/workshopfile/w1': () => (++attempts === 1 ? jsonResponse({}, 500) : jsonResponse(files)) });
    renderAt('#materiali');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('I materiali non sono disponibili (Errore HTTP: 500).');
    await user.click(within(alert).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Slide Blazor')).toBeInTheDocument();
  });
});

describe('Foto', () => {
  test('shows the photos from /Contents, uploads them as photos and lets a delete be cancelled', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('#foto');
    const photos = await screen.findByRole('region', { name: "Foto dell'evento" });
    expect(within(photos).getByRole('img', { name: 'Sala piena' })).toHaveAttribute('src', contentUrl('/workshops/w001/photos/p1.jpg'));
    expect(within(photos).queryByText('Slide Blazor')).not.toBeInTheDocument();

    const input = photos.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['img'], 'gruppo.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(api.to('/workshopfile/Upload', 'POST')).toHaveLength(1));
    expect(api.to('/workshopfile/Upload')[0].form!.get('fileType')).toBe('2');
    expect(await screen.findByText('1 foto caricata')).toBeInTheDocument();

    await user.click(within(photos).getByRole('button', { name: 'Elimina: Sala piena' }));
    await user.click(within(photos).getByRole('button', { name: 'Annulla' }));
    expect(api.to('/workshopfile/f2', 'DELETE')).toHaveLength(0);
    expect(within(photos).getByRole('img', { name: 'Sala piena' })).toBeInTheDocument();
  });

  test('ends the wizard with "Salva modifiche", which sends the whole record even when nothing changed, as before', async () => {
    const user = userEvent.setup();
    const api = serveEvent(eventFixture(), {}, { files });
    renderAt('#foto');
    await screen.findByRole('region', { name: "Foto dell'evento" });
    expect(screen.queryByRole('button', { name: /^Avanti/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(api.to('/Workshop/Update/w1', 'PUT')).toHaveLength(1));
    expect(api.lastUpdate()).toMatchObject({ title: 'Test Workshop', published: true, location: { name: 'Genova' } });
    expect(await screen.findByText('Modifiche salvate')).toBeInTheDocument();
  });
});
