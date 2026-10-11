import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { AdminToastRegion, adminToasts } from '../toasts';
import MenuPage from './MenuPage';

type Item = { topMenuElementId: string; name: string; url: string; order: number; isActive: boolean; [key: string]: unknown };

const home: Item = { topMenuElementId: 'm-home', name: 'Home', url: '/', order: 1, isActive: true };
const events: Item = { topMenuElementId: 'm-events', name: 'Eventi passati', url: '/workshops', order: 2, isActive: true };
const team: Item = { topMenuElementId: 'm-team', name: 'Il Team', url: '/#team', order: 3, isActive: true, legacyNote: 'tenere' };
const sponsor: Item = { topMenuElementId: 'm-sponsor', name: 'Sponsor', url: '/sponsor', order: 4, isActive: false };

/** The API sends the active entries first and the inactive ones last; the page sorts by order. */
function serve(initial: Item[] = [team, home, events, sponsor], options: { deleteStatuses?: number[] } = {}) {
  let db = initial.map(item => ({ ...item }));
  const writes: { id?: string; method?: string; body?: Item }[] = [];
  const deleteStatuses = [...(options.deleteStatuses ?? [])];
  let nextId = 1;
  mockApi({
    '/TopMenu/': (url: string, init?: RequestInit) => {
      const id = url.split('/TopMenu/')[1];
      if (init?.method === 'DELETE') {
        writes.push({ id, method: 'DELETE' });
        const status = deleteStatuses.shift() ?? 204;
        if (status === 204) db = db.filter(item => item.topMenuElementId !== id);
        return new Response(null, { status });
      }
      const body = JSON.parse(String(init?.body)) as Item;
      writes.push({ id, method: init?.method, body });
      db[db.findIndex(item => item.topMenuElementId === id)] = body;
      return new Response(null, { status: 204 });
    },
    '/TopMenu': (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Item;
        writes.push({ method: 'POST', body });
        const created = { ...body, topMenuElementId: `m-new-${nextId++}` };
        db.push(created);
        return jsonResponse(created, 201);
      }
      return jsonResponse(db);
    },
  });
  return { writes, items: () => db };
}

const renderAt = (route: string) => render(
  <>
    <Routes>
      <Route path="/admin/topmenu/" element={<MenuPage />} />
      <Route path="/admin/topmenu/:id" element={<MenuPage />} />
    </Routes>
    <AdminToastRegion />
  </>,
  { route },
);
const rowNames = () => screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('link')[0].textContent);
const previewNames = () => within(screen.getByRole('list', { name: 'Voci attive nel menu' })).getAllByRole('listitem').map(li => li.textContent);

beforeEach(() => adminToasts.clear());

describe('<MenuPage />', () => {
  test('lists the entries by order with their address and state, and previews the active ones in the header', async () => {
    serve();
    renderAt('/admin/topmenu/');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Menu del sito' })).toBeInTheDocument();
    expect(screen.getByText(/^4 voci, 3 attive\./)).toBeInTheDocument();
    expect(rowNames()).toEqual(['Home', 'Eventi passati', 'Il Team', 'Sponsor']);
    expect(screen.getByText('/#team')).toBeInTheDocument();
    expect(screen.getAllByText('Non attiva')).toHaveLength(1);
    expect(within(screen.getAllByRole('row')[4]).getByText('Non attiva')).toBeInTheDocument();
    expect(screen.getByText('3 di 4 voci attive nel menu')).toBeInTheDocument();
    // The preview lists what the public header lists: active entries only, in order.
    expect(previewNames()).toEqual(['Home', 'Eventi passati', 'Il Team']);
    expect(screen.getByRole('link', { name: 'Nuova voce' })).toHaveAttribute('href', '/admin/topmenu/new');
  });

  test('moves an entry with the arrow buttons and the preview follows', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/topmenu/');
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Sposta in alto: Home' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in basso: Sponsor' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Sposta in alto: Il Team' }));

    await waitFor(() => expect(rowNames()).toEqual(['Home', 'Il Team', 'Eventi passati', 'Sponsor']));
    expect(previewNames()).toEqual(['Home', 'Il Team', 'Eventi passati']);
    const byId = Object.fromEntries(writes.map(w => [w.id, w.body]));
    expect(writes.map(w => w.method)).toEqual(['PUT', 'PUT']);
    expect(byId['m-team']).toEqual({ ...team, order: 2 });
    expect(byId['m-events']).toEqual({ ...events, order: 3 });
    expect(screen.getByRole('status')).toHaveTextContent('Il Team spostata in posizione 2 di 4.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sposta in alto: Il Team' })).toHaveFocus());
  });

  test('opens the entry card from its address and saves edits as one update of the whole record', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/topmenu/m-team');
    const card = await screen.findByRole('dialog', { name: 'Il Team' });
    expect(within(card).getByRole('link', { name: /\/#team/ })).toHaveAttribute('href', '/#team');
    expect(within(card).getByText('3 di 4 (ordine 3)')).toBeInTheDocument();
    expect(within(card).getByText('Attiva nel menu')).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Modifica' }));
    const name = within(card).getByRole('textbox', { name: /Nome/ });
    await user.clear(name);
    await user.type(name, 'Chi siamo');
    const address = within(card).getByRole('textbox', { name: /Indirizzo/ });
    await user.clear(address);
    await user.type(address, '/#chi-siamo');
    await user.click(within(card).getByRole('switch', { name: 'Attiva nel menu' }));
    await user.click(within(card).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({ id: 'm-team', method: 'PUT', body: { ...team, name: 'Chi siamo', url: '/#chi-siamo', isActive: false } });
    expect(await screen.findByText('Voce aggiornata')).toBeInTheDocument();
    expect(await within(card).findByText('Non attiva')).toBeInTheDocument();
  });

  test('opens straight in the form from the row action', async () => {
    serve();
    renderAt('/admin/topmenu/m-home?azione=modifica');
    const card = await screen.findByRole('dialog', { name: 'Home' });
    expect(within(card).getByRole('textbox', { name: /Nome/ })).toHaveValue('Home');
    expect(within(card).getByRole('button', { name: 'Salva' })).toBeInTheDocument();
  });

  test('creates an entry: name and a valid address are required, and it goes last by default', async () => {
    const user = userEvent.setup();
    const { writes, items } = serve();
    renderAt('/admin/topmenu/new');
    const dialog = await screen.findByRole('dialog', { name: 'Nuova voce del menu' });
    expect(within(dialog).getByRole('spinbutton', { name: /Ordine/ })).toHaveValue(5);
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(within(dialog).getByText('Il nome è obbligatorio.')).toBeInTheDocument();
    expect(within(dialog).getByText("L'indirizzo è obbligatorio.")).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: /Nome/ }), 'Contatti');
    await user.type(within(dialog).getByRole('textbox', { name: /Indirizzo/ }), 'contatti');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(within(dialog).getByText(/Indica una pagina del sito/)).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await user.clear(within(dialog).getByRole('textbox', { name: /Indirizzo/ }));
    await user.type(within(dialog).getByRole('textbox', { name: /Indirizzo/ }), '/contatti');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writes).toEqual([{ method: 'POST', body: { topMenuElementId: '00000000-0000-0000-0000-000000000000', name: 'Contatti', url: '/contatti', order: 5, isActive: true } }]));
    expect(await screen.findByText('Voce creata')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(items().map(item => item.name)).toContain('Contatti');
    await waitFor(() => expect(rowNames()).toEqual(['Home', 'Eventi passati', 'Il Team', 'Sponsor', 'Contatti']));
    expect(previewNames()).toEqual(['Home', 'Eventi passati', 'Il Team', 'Contatti']);
  });

  test('deletes only after an explicit confirmation and reports failures', async () => {
    const user = userEvent.setup();
    const { writes, items } = serve([team, home, events, sponsor], { deleteStatuses: [404, 204] });
    renderAt('/admin/topmenu/m-sponsor');
    const card = await screen.findByRole('dialog', { name: 'Sponsor' });
    expect(within(card).getByText('La voce non compare nel menu del sito finché non la attivi.')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /Elimina/ }));
    expect(within(card).getByText('Eliminare Sponsor?')).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.click(within(card).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Eliminazione non riuscita')).toBeInTheDocument();
    expect(screen.getByText('Errore HTTP: 404')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText('Voce eliminata')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes.map(w => `${w.method} ${w.id}`)).toEqual(['DELETE m-sponsor', 'DELETE m-sponsor']);
    expect(items().map(item => item.name)).not.toContain('Sponsor');
    await waitFor(() => expect(rowNames()).toEqual(['Home', 'Eventi passati', 'Il Team']));
  });

  test('the row menu keeps the destructive action last and opens the confirmation', async () => {
    const user = userEvent.setup();
    serve();
    renderAt('/admin/topmenu/');
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Altre azioni per Sponsor' }));
    const menu = await screen.findByRole('menu', { name: 'Altre azioni per Sponsor' });
    const labels = within(menu).getAllByRole('menuitem').map(item => item.textContent);
    expect(labels).toEqual(['Apri sul sito (si apre in una nuova scheda)', 'Attiva', 'Elimina…']);
    expect(within(menu).getByRole('menuitem', { name: /Apri sul sito/ })).toHaveAttribute('href', '/sponsor');
    await user.click(within(menu).getByRole('menuitem', { name: 'Elimina…' }));
    const card = await screen.findByRole('dialog', { name: 'Sponsor' });
    expect(within(card).getByText('Eliminare Sponsor?')).toBeInTheDocument();
  });

  test('activates and deactivates an entry from the row menu', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/topmenu/');
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Altre azioni per Eventi passati' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Disattiva' }));
    expect(await screen.findByText('Voce disattivata')).toBeInTheDocument();
    expect(writes).toEqual([{ id: 'm-events', method: 'PUT', body: { ...events, isActive: false } }]);
    await waitFor(() => expect(previewNames()).toEqual(['Home', 'Il Team']));
    expect(screen.getByText('2 di 4 voci attive nel menu')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Altre azioni per Sponsor' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Attiva' }));
    expect(await screen.findByText('Voce attivata')).toBeInTheDocument();
    await waitFor(() => expect(previewNames()).toEqual(['Home', 'Il Team', 'Sponsor']));
  });

  test('warns when no entry is active, because the header would be empty', async () => {
    serve([{ ...sponsor }]);
    renderAt('/admin/topmenu/');
    expect(await screen.findByText('Nessuna voce attiva: il menu del sito resta vuoto.')).toBeInTheDocument();
  });

  test('shows an empty state when there are no entries', async () => {
    serve([]);
    renderAt('/admin/topmenu/');
    expect(await screen.findByText('Nessuna voce nel menu')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('reports a failed load with a retry instead of an empty list', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockApi({ '/TopMenu': () => (++attempts === 1 ? new Response(null, { status: 503 }) : jsonResponse([home])) });
    renderAt('/admin/topmenu/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Il menu non è disponibile (Errore HTTP: 503).');
    expect(screen.queryByText('Nessuna voce nel menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Home']);
  });

  test('says so when the address does not match any entry', async () => {
    serve();
    renderAt('/admin/topmenu/nope');
    const dialog = await screen.findByRole('dialog', { name: 'Scheda della voce' });
    expect(await within(dialog).findByText('Voce non trovata')).toBeInTheDocument();
  });

  test('turns into a list of cards on phones, with the same controls', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { writes } = serve();
    renderAt('/admin/topmenu/');
    await screen.findByText(/^4 voci/);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = within(screen.getAllByRole('list')[0]).getAllByRole('listitem');
    expect(cards.map(card => within(card).getAllByRole('link')[0].textContent)).toEqual(['Home', 'Eventi passati', 'Il Team', 'Sponsor']);
    expect(within(cards[3]).getByText('Non attiva')).toBeInTheDocument();
    await user.click(within(cards[1]).getByRole('button', { name: 'Sposta in basso: Eventi passati' }));
    await waitFor(() => expect(writes).toHaveLength(2));
  });
});
