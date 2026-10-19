import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { ADMIN_CAPABILITIES, NO_CAPABILITIES, jsonResponse, mockApi, render, screen, within, waitFor } from '../test-utils';
import AdminShell from './AdminShell';

function Where() {
  const location = useLocation();
  return <output aria-label="posizione">{location.pathname + location.search}</output>;
}

const renderShell = (route: string) => render(
  <Routes>
    <Route element={<AdminShell />}>
      <Route path="/admin" element={<h1>Panoramica di prova</h1>} />
      <Route path="/admin/*" element={<h1>Pagina admin</h1>} />
    </Route>
    <Route path="*" element={<Where />} />
  </Routes>,
  { route, accountProvider: true },
);

const signedIn = (logout = vi.fn(async () => undefined)) => {
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout, renewTokens: vi.fn() } as unknown as ReturnType<typeof useOidc>);
  mockApi({ 'account/capabilities': ADMIN_CAPABILITIES });
  return logout;
};

describe('<AdminShell />', () => {
  test('groups the sections and marks the current one, including event pages under Eventi', async () => {
    signedIn();
    const { unmount } = renderShell('/admin');
    const sections = await screen.findByRole('navigation', { name: 'Sezioni' });
    expect(within(sections).getAllByRole('link').map(l => l.textContent)).toEqual(['Panoramica', 'Eventi', 'Relatori', 'Sedi', 'Board', 'Questionari', 'Menu del sito', 'Backup e import', 'Privacy e avvisi', 'Accessi utenti']);
    expect(within(sections).getByRole('link', { name: 'Panoramica' })).toHaveAttribute('aria-current', 'page');
    unmount();

    renderShell('/admin/workshop/abc');
    const again = await screen.findByRole('navigation', { name: 'Sezioni' });
    expect(within(again).getByRole('link', { name: 'Eventi' })).toHaveAttribute('aria-current', 'page');
    expect(within(again).getByRole('link', { name: 'Panoramica' })).not.toHaveAttribute('aria-current');
  });

  test('positions the content and the sidebar scrollers, so absolutely placed children stay inside them', async () => {
    signedIn();
    renderShell('/admin');
    await screen.findByRole('navigation', { name: 'Sezioni' });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'contenuto-admin');
    expect(main).toHaveClass('relative');
    expect(screen.getByRole('navigation', { name: 'Sezioni' })).toHaveClass('relative');
  });

  test('opens the quick search with Ctrl+K and jumps to a speaker', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    signedIn();
    mockApi({
      'account/capabilities': ADMIN_CAPABILITIES,
      '/Workshop/Get': [{ workshopId: 'w1', title: 'AI Generativa', eventDate: '2025-06-12T00:00:00+02:00', location: { name: 'Confindustria' } }],
      '/Speaker/Get': [{ workshopSpeakerId: 's1', name: 'Ada Lovelace' }, { workshopSpeakerId: 's2', name: 'Alan Turing' }],
    });
    renderShell('/admin');
    await screen.findByRole('navigation', { name: 'Sezioni' });
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Cerca e vai' });
    await within(dialog).findByText('Ada Lovelace');
    await user.keyboard('turing');
    expect(within(dialog).queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('AI Generativa')).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByRole('heading', { name: 'Pagina admin' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('signs out from the profile menu', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const logout = signedIn();
    localStorage.setItem('profileStore', '{}');
    renderShell('/admin');
    await user.click(await screen.findByRole('button', { name: /^Menu di Test User/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Esci' }));
    expect(logout).toHaveBeenCalled();
    expect(localStorage.getItem('profileStore')).toBeNull();
    expect(await screen.findByLabelText('posizione')).toHaveTextContent(/^\/$/);
  });

  test('on phones offers the other sections from the Altro sheet', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    signedIn();
    renderShell('/admin/board/');
    const tabs = await screen.findByRole('navigation', { name: 'Sezioni principali' });
    expect(within(tabs).getAllByRole('link').map(l => l.textContent)).toEqual(['Panoramica', 'Eventi', 'Relatori']);
    await user.click(within(tabs).getByRole('button', { name: 'Altro' }));
    const sheet = await screen.findByRole('dialog', { name: 'Altre sezioni' });
    expect(within(sheet).getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page');
    expect(within(sheet).getByRole('link', { name: /Vedi il sito/ })).toHaveAttribute('target', '_blank');
  });

  test.each([NO_CAPABILITIES, { ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['events.past.manage'] }])('denies ordinary and modifier-only accounts without mounting pages or palette', async capabilities => {
    signedIn();
    mockApi({ 'account/capabilities': capabilities });
    renderShell('/admin');
    await screen.findByRole('heading', { name: 'Accesso non autorizzato' });
    await userEvent.setup({ delay: null }).keyboard('{Control>}k{/Control}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panoramica di prova' })).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).endsWith('/account/capabilities'))).toBe(true);
  });

  test('waits for server authorization before mounting a page and exposes retry on failure', async () => {
    signedIn();
    let resolve!: (value: Response) => void;
    mockApi({ 'account/capabilities': () => new Promise<Response>(done => { resolve = done; }) });
    renderShell('/admin');
    expect(screen.getByRole('status')).toHaveTextContent('Verifica dei permessi');
    expect(screen.queryByRole('heading', { name: 'Panoramica di prova' })).not.toBeInTheDocument();
    resolve(jsonResponse({}, 503));
    await screen.findByRole('heading', { name: 'Permessi non disponibili' });
    mockApi({ 'account/capabilities': ADMIN_CAPABILITIES });
    await userEvent.click(screen.getByRole('button', { name: 'Riprova verifica permessi' }));
    await screen.findByRole('heading', { name: 'Panoramica di prova' });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('account/capabilities'), expect.objectContaining({ cache: 'no-store' }));
  });

  test.each(['/admin/questionnaires', '/admin/import-export/', '/admin/privacy'])('filters specialized navigation and denies direct access %s', async route => {
    signedIn();
    mockApi({ 'account/capabilities': { ...NO_CAPABILITIES, canAccessAdmin: true, permissions: ['events.read'] } });
    renderShell(route);
    await screen.findByRole('heading', { name: 'Accesso non autorizzato' });
    const sections = screen.getByRole('navigation', { name: 'Sezioni' });
    for (const label of ['Questionari', 'Backup e import', 'Privacy e avvisi'])
      expect(within(sections).queryByRole('link', { name: label })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Pagina admin' })).not.toBeInTheDocument());
  });
});
