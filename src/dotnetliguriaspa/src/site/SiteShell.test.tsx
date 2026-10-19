import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { ADMIN_CAPABILITIES, NO_CAPABILITIES, jsonResponse, mockApi, render, screen, within, waitFor } from '../test-utils';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import { useAccountCapabilities } from '../account/AccountCapabilities';

function CapabilityState() {
  const { status } = useAccountCapabilities();
  return <output data-testid="capability-state">{status}</output>;
}

const mainNav = () => screen.getByRole('navigation', { name: 'Principale' });

describe('<SiteHeader />', () => {
  test('shows only active menu entries in their configured order', async () => {
    mockApi({
      '/TopMenu': [
        { name: 'Dopo', url: '/dopo', isActive: true, order: 2 },
        { name: 'Nascosta', url: '/nascosta', isActive: false, order: 0 },
        { name: 'Prima', url: '/prima', isActive: true, order: 1 },
      ],
    });
    render(<SiteHeader />);
    expect(await within(mainNav()).findByRole('link', { name: 'Prima' })).toHaveAttribute('href', '/prima');
    expect(within(mainNav()).getAllByRole('link').map(link => link.textContent)).toEqual(['Prima', 'Dopo']);
    expect(screen.getByRole('link', { name: 'DotNetLiguria, pagina iniziale' })).toHaveAttribute('href', '/');
  });

  test('keeps the site navigable when the menu cannot be loaded', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Offline'));
    render(<SiteHeader />);
    expect(await within(mainNav()).findByRole('link', { name: 'Eventi passati' })).toHaveAttribute('href', '/workshops');
    expect(within(mainNav()).getByRole('link', { name: 'Il Team' })).toHaveAttribute('href', '/#team');
  });

  test('opens the phone menu and closes it with Escape, returning focus to the button', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    mockApi({ '/TopMenu': [{ name: 'Eventi passati', url: '/workshops', isActive: true, order: 1 }] });
    render(<SiteHeader />);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findAllByRole('navigation', { name: 'Principale' })).toHaveLength(2);
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  test('offers login to visitors and logout to signed-in users', async () => {
    const user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const visitor = render(<SiteHeader />);
    await user.click(screen.getByRole('button', { name: 'Area Personale' }));
    expect(useOidc().login).toHaveBeenCalledWith('/');
    visitor.unmount();

    const logout = vi.fn(async () => undefined);
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout } as unknown as ReturnType<typeof useOidc>);
    localStorage.setItem('profileStore', '{}');
    mockApi({ 'account/capabilities': NO_CAPABILITIES });
    render(<SiteHeader />, { accountProvider: true });
    await user.click(screen.getByRole('button', { name: 'Ciao, Test User' }));
    expect(screen.getByRole('menuitem', { name: 'Area personale' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Dashboard' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Esci' }));
    expect(logout).toHaveBeenCalled();
    expect(localStorage.getItem('profileStore')).toBeNull();
  });

  test.each(['/', '/workshop/synthetic?source=email#agenda', '/q/questionnaire?step=2#consenso'])('login returns to exact address %s', async route => {
    render(<SiteHeader />, { route });
    await userEvent.click(screen.getByRole('button', { name: 'Area Personale' }));
    expect(useOidc().login).toHaveBeenCalledWith(route);
  });

  test.each([NO_CAPABILITIES, ADMIN_CAPABILITIES])('greeting dropdown uses server capability and Escape returns keyboard focus', async capabilities => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    mockApi({ 'account/capabilities': capabilities });
    render(<SiteHeader />, { accountProvider: true });
    const controls = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const greeting = screen.getByRole('button', { name: 'Ciao, Test User' });
    await controls.click(greeting);
    const menu = await screen.findByRole('menu', { name: 'Ciao, Test User' });
    expect(within(menu).queryByRole('menuitem', { name: 'Dashboard' }) !== null).toBe(capabilities.canAccessAdmin);
    await controls.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(greeting).toHaveFocus());
  });

  test('mobile account navigation closes the disclosure', async () => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    mockApi({ 'account/capabilities': NO_CAPABILITIES });
    render(<SiteHeader />, { accountProvider: true });
    const controls = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    const toggle = screen.getByRole('button', { name: 'Menu' });
    await controls.click(toggle);
    const navs = screen.getAllByRole('navigation', { name: 'Principale' });
    await controls.click(within(navs[1]).getByRole('button', { name: 'Ciao, Test User' }));
    await controls.click(await screen.findByRole('menuitem', { name: 'Area personale' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('unauthorized accounts have no administration or permission-status menu entry', async () => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    mockApi({ 'account/capabilities': NO_CAPABILITIES });
    render(<SiteHeader />, { accountProvider: true });
    const controls = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('account/capabilities'), expect.anything()));
    await controls.click(screen.getByRole('button', { name: 'Ciao, Test User' }));
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Area personale', 'Esci']);
    expect(screen.queryByText(/permessi|verifica.*non riuscita/i)).not.toBeInTheDocument();
  });

  test('capability failures do not add an administrative banner or dropdown entry to the public header', async () => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
    mockApi({ 'account/capabilities': () => jsonResponse({ code: 'identity_verification_unavailable' }, 503) });
    render(<><SiteHeader /><CapabilityState /></>, { accountProvider: true });
    const controls = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    await waitFor(() => expect(screen.getByTestId('capability-state')).toHaveTextContent('error'));
    expect(screen.queryByText(/verifica.*non riuscita|riprova verifica|permessi/i)).not.toBeInTheDocument();
    await controls.click(screen.getByRole('button', { name: 'Ciao, Test User' }));
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Area personale', 'Esci']);
  });
});

describe('<SiteFooter />', () => {
  test('links the archive, the team and the three legal pages', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Eventi passati' })).toHaveAttribute('href', '/workshops');
    expect(screen.getByRole('link', { name: 'Il team' })).toHaveAttribute('href', '/#team');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Termini di servizio' })).toHaveAttribute('href', '/termini-di-servizio');
    expect(screen.getByRole('link', { name: 'Cookie' })).toHaveAttribute('href', '/cookie');
    expect(screen.queryByText('da completare')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'DotNetLiguria' })).toBeInTheDocument();
  });

  test('groups the links into two labelled navigations, with no unnamed one', () => {
    render(<SiteFooter />);
    const site = screen.getByRole('navigation', { name: 'Il sito' });
    expect(within(site).getAllByRole('link').map(link => link.textContent)).toEqual(['Eventi passati', 'Il team']);
    const legal = screen.getByRole('navigation', { name: 'Informazioni legali' });
    expect(within(legal).getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Privacy', '/privacy'],
      ['Termini di servizio', '/termini-di-servizio'],
      ['Cookie', '/cookie'],
    ]);
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
  });

  test('shows the legal line as the owner wrote it, with the authors notice', () => {
    render(<SiteFooter />);
    expect(screen.getByText(
      '©DotNetLiguria, hosted by Vevy Europe S.p.A. via Semeria, 16A - 16131 Genova - Italia - P.IVA IT00269300109',
    )).toBeInTheDocument();
    expect(screen.getByText('I contenuti dei talk appartengono ai rispettivi autori.')).toBeInTheDocument();
  });
});
