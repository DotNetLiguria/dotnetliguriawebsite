import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor, within } from '../../test-utils';
import { contentUrl } from '../../site/siteApi';
import { AdminToastRegion, adminToasts } from '../toasts';
import BoardPage from './BoardPage';

type Member = Record<string, unknown> & { boardId: string };

const rialdi: Member = {
  boardId: 'b-rialdi', name: 'Raffaele Rialdi', description: 'Presidente', email: 'rr@example.test', profileImageUrl: 'profile/raffaele-rialdi.jpg',
  shortBio: 'Sviluppa software dal 1987.', fullBio: 'Biografia estesa.', blogHtml: 'https://blog.example.test/raf', isActive: true, order: 1, legacyNote: 'tenere',
};
const gambaro: Member = {
  boardId: 'b-gambaro', name: 'Alessandro Gambaro', description: 'Vice Presidente', email: 'ag@example.test', profileImageUrl: 'profile/alessandro-gambaro.jpg',
  shortBio: 'Ingegnere informatico.', lInkedinUrl: 'https://www.linkedin.com/in/ag', twitterUrl: 'javascript:alert(1)', isActive: true, order: 2,
};
const baroni: Member = { boardId: 'b-baroni', name: 'Alberto Baroni', description: 'Consigliere', isActive: false, order: 3 };

/** The API sends the visible members first and the hidden ones last; the page sorts by order. */
function serve(initial: Member[] = [gambaro, rialdi, baroni], options: { failUpdates?: boolean } = {}) {
  const db = initial.map(member => ({ ...member }));
  const writes: { id: string; method?: string; body: Member }[] = [];
  mockApi({
    '/Board/Update/': (url: string, init?: RequestInit) => {
      const id = url.split('/Board/Update/')[1];
      const body = JSON.parse(String(init?.body)) as Member;
      writes.push({ id, method: init?.method, body });
      if (options.failUpdates) return new Response(null, { status: 500 });
      db[db.findIndex(member => member.boardId === id)] = body;
      return new Response(null, { status: 204 });
    },
    '/Board/Get': () => jsonResponse(db),
  });
  return { db, writes };
}

const renderAt = (route: string) => render(
  <>
    <Routes>
      <Route path="/admin/board/" element={<BoardPage />} />
      <Route path="/admin/board/:id" element={<BoardPage />} />
    </Routes>
    <AdminToastRegion />
  </>,
  { route },
);
const rowNames = () => screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('link')[0].textContent);

beforeEach(() => adminToasts.clear());

describe('<BoardPage />', () => {
  test('lists the members by order with role, visibility and the footer count', async () => {
    serve();
    renderAt('/admin/board/');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByText(/^3 membri\./)).toBeInTheDocument();
    expect(rowNames()).toEqual(['Raffaele Rialdi', 'Alessandro Gambaro', 'Alberto Baroni']);
    expect(screen.getByText('Presidente')).toBeInTheDocument();
    // Only the exception gets a badge.
    expect(screen.getAllByText('Nascosto')).toHaveLength(1);
    expect(within(screen.getAllByRole('row')[3]).getByText('Nascosto')).toBeInTheDocument();
    expect(screen.getByText('2 di 3 membri visibili sul sito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sposta in alto: Raffaele Rialdi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in basso: Alberto Baroni' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Modifica Raffaele Rialdi' })).toHaveAttribute('href', '/admin/board/b-rialdi?azione=modifica');
  });

  test('moves a member with the arrow buttons: both records are saved, announced, and focus stays on the control', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/board/');
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Sposta in alto: Alessandro Gambaro' }));

    await waitFor(() => expect(rowNames()).toEqual(['Alessandro Gambaro', 'Raffaele Rialdi', 'Alberto Baroni']));
    expect(writes.map(w => w.method)).toEqual(['PUT', 'PUT']);
    const byId = Object.fromEntries(writes.map(w => [w.id, w.body]));
    // The whole record goes back, with only the order changed.
    expect(byId['b-gambaro']).toEqual({ ...gambaro, order: 1 });
    expect(byId['b-rialdi']).toEqual({ ...rialdi, order: 2 });
    expect(screen.getByRole('status')).toHaveTextContent('Alessandro Gambaro spostato in posizione 1 di 3.');
    // It is now first: the "up" control is disabled, so focus goes to its neighbour.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sposta in basso: Alessandro Gambaro' })).toHaveFocus());
  });

  test('reports a failed move and shows the list as the server has it', async () => {
    const user = userEvent.setup();
    const { writes } = serve([gambaro, rialdi, baroni], { failUpdates: true });
    renderAt('/admin/board/');
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Sposta in basso: Raffaele Rialdi' }));
    expect(await screen.findByText('Spostamento non riuscito')).toBeInTheDocument();
    expect(screen.getByText('Errore HTTP: 500')).toBeInTheDocument();
    expect(writes).toHaveLength(2);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sposta in basso: Raffaele Rialdi' })).toBeEnabled());
    expect(rowNames()).toEqual(['Raffaele Rialdi', 'Alessandro Gambaro', 'Alberto Baroni']);
  });

  test('hides and shows a member from the row menu', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/board/');
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Altre azioni per Raffaele Rialdi' }));
    const menu = await screen.findByRole('menu', { name: 'Altre azioni per Raffaele Rialdi' });
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Nascondi dal sito', 'Vedi il team sul sito (si apre in una nuova scheda)']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Nascondi dal sito' }));
    expect(await screen.findByText('Membro nascosto dal sito')).toBeInTheDocument();
    expect(writes).toEqual([expect.objectContaining({ id: 'b-rialdi', method: 'PUT', body: { ...rialdi, isActive: false } })]);
    await waitFor(() => expect(screen.getByText('1 di 3 membri visibili sul sito')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Altre azioni per Alberto Baroni' }));
    expect(await screen.findByRole('menuitem', { name: 'Mostra sul sito' })).toBeInTheDocument();
  });

  test('opens the member card as a dialog from its address, with links and no script links', async () => {
    serve();
    renderAt('/admin/board/b-gambaro');
    const card = await screen.findByRole('dialog', { name: 'Alessandro Gambaro' });
    expect(within(card).getByText('Vice Presidente')).toBeInTheDocument();
    expect(within(card).getByText('Visibile sul sito')).toBeInTheDocument();
    expect(within(card).getByText('Ingegnere informatico.')).toBeInTheDocument();
    expect(within(card).getByText('ag@example.test')).toBeInTheDocument();
    expect(within(card).getByText('2 di 3 (ordine 2)')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /linkedin\.com\/in\/ag/ })).toHaveAttribute('href', 'https://www.linkedin.com/in/ag');
    expect(within(card).queryByRole('link', { name: /javascript/ })).not.toBeInTheDocument();
    expect(within(card).getByText('javascript:alert(1)')).toBeInTheDocument();
    expect(within(card).getByText('Non valido')).toBeInTheDocument();
    expect(card.querySelector('img')).toHaveAttribute('src', contentUrl('profile/alessandro-gambaro.jpg'));
  });

  test('edits every field in one form and saves the whole record once', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/board/b-rialdi');
    const card = await screen.findByRole('dialog', { name: 'Raffaele Rialdi' });
    await user.click(within(card).getByRole('button', { name: 'Modifica' }));

    const role = within(card).getByRole('textbox', { name: 'Ruolo' });
    await user.clear(role);
    await user.type(role, 'Presidente onorario');
    await user.clear(within(card).getByRole('textbox', { name: 'Email' }));
    await user.type(within(card).getByRole('textbox', { name: 'GitHub' }), 'https://github.com/raffaeler');
    await user.type(within(card).getByRole('textbox', { name: 'Presentazione breve' }), ' Docente e speaker.');
    await user.clear(within(card).getByRole('spinbutton', { name: /Ordine/ }));
    await user.type(within(card).getByRole('spinbutton', { name: /Ordine/ }), '5');
    await user.click(within(card).getByRole('switch', { name: 'Visibile sul sito' }));
    await user.click(within(card).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].id).toBe('b-rialdi');
    expect(writes[0].method).toBe('PUT');
    expect(writes[0].body).toEqual({
      ...rialdi,
      description: 'Presidente onorario', email: null, gitHubUrl: 'https://github.com/raffaeler',
      shortBio: 'Sviluppa software dal 1987. Docente e speaker.', order: 5, isActive: false,
      lInkedinUrl: null, twitterUrl: null, faceboookUrl: null, instagramUrl: null,
    });
    expect(await screen.findByText('Membro aggiornato')).toBeInTheDocument();
    // Back to the read view, showing what the server now holds.
    expect(await within(card).findByRole('button', { name: 'Modifica' })).toBeInTheDocument();
    expect(within(card).getByText('Nascosto dal sito')).toBeInTheDocument();
  });

  test('opens straight in the form from the row action and refuses a missing name, a bad link and a bad order', async () => {
    const user = userEvent.setup();
    const { writes } = serve();
    renderAt('/admin/board/b-rialdi?azione=modifica');
    const card = await screen.findByRole('dialog', { name: 'Raffaele Rialdi' });
    await user.clear(within(card).getByRole('textbox', { name: /Nome/ }));
    await user.clear(within(card).getByRole('textbox', { name: 'Blog' }));
    await user.type(within(card).getByRole('textbox', { name: 'Blog' }), 'ftp://example.test/blog');
    await user.clear(within(card).getByRole('spinbutton', { name: /Ordine/ }));
    await user.type(within(card).getByRole('spinbutton', { name: /Ordine/ }), '-1');
    await user.click(within(card).getByRole('button', { name: 'Salva' }));
    expect(within(card).getByText('Il nome è obbligatorio.')).toBeInTheDocument();
    expect(within(card).getByText('Indica un indirizzo che inizi con http:// o https://.')).toBeInTheDocument();
    expect(within(card).getByText('Indica un numero intero, zero o maggiore.')).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  test('keeps the form open and reports a failed save', async () => {
    const user = userEvent.setup();
    const { writes } = serve([gambaro, rialdi, baroni], { failUpdates: true });
    renderAt('/admin/board/b-baroni?azione=modifica');
    const card = await screen.findByRole('dialog', { name: 'Alberto Baroni' });
    await user.type(within(card).getByRole('textbox', { name: 'Ruolo' }), ' e tesoriere');
    await user.click(within(card).getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText('Salvataggio non riuscito')).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    expect(within(card).getByRole('textbox', { name: 'Ruolo' })).toHaveValue('Consigliere e tesoriere');
  });

  test('says when a member has no photo yet, and that the upload is still to be done', async () => {
    const user = userEvent.setup();
    serve();
    renderAt('/admin/board/b-baroni');
    const card = await screen.findByRole('dialog', { name: 'Alberto Baroni' });
    expect(within(card).getByText('Manca la foto')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Modifica' }));
    expect(within(card).getByText(/caricamento diretto della foto è da completare/)).toBeInTheDocument();
  });

  test('reports a failed load with a retry instead of an empty list', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockApi({ '/Board/Get': () => (++attempts === 1 ? new Response(null, { status: 500 }) : jsonResponse([rialdi])) });
    renderAt('/admin/board/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Il board non è disponibile (Errore HTTP: 500).');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Nessun membro del board')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Raffaele Rialdi']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a card opened while the list cannot be loaded says so', async () => {
    mockApi({ '/Board/Get': () => new Response(null, { status: 500 }) });
    renderAt('/admin/board/b-rialdi');
    const dialog = await screen.findByRole('dialog', { name: 'Scheda del membro' });
    expect(await within(dialog).findByText('Scheda non disponibile')).toBeInTheDocument();
  });

  test('says so when the address does not match any member', async () => {
    serve();
    renderAt('/admin/board/nobody');
    const dialog = await screen.findByRole('dialog', { name: 'Scheda del membro' });
    expect(await within(dialog).findByText('Membro non trovato')).toBeInTheDocument();
  });

  test('shows an empty state when the board has no members', async () => {
    serve([]);
    renderAt('/admin/board/');
    expect(await screen.findByText('Nessun membro del board')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('turns into a list of cards on phones, with the same controls', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { writes } = serve();
    renderAt('/admin/board/');
    const list = await screen.findByRole('list');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = within(list).getAllByRole('listitem');
    expect(cards.map(card => within(card).getAllByRole('link')[0].textContent)).toEqual(['Raffaele Rialdi', 'Alessandro Gambaro', 'Alberto Baroni']);
    expect(within(cards[2]).getByText('Nascosto')).toBeInTheDocument();
    expect(within(cards[1]).getByText('2 di 3')).toBeInTheDocument();
    await user.click(within(cards[1]).getByRole('button', { name: 'Sposta in alto: Alessandro Gambaro' }));
    await waitFor(() => expect(writes).toHaveLength(2));
  });
});
