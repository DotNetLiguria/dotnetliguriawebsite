import React from 'react';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { mockApi, render, screen, within } from '../test-utils';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

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
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
    const visitor = render(<SiteHeader />);
    await user.click(screen.getByRole('button', { name: 'Area Personale' }));
    expect(useOidc().login).toHaveBeenCalledWith('/admin');
    visitor.unmount();

    const logout = vi.fn(async () => undefined);
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout } as unknown as ReturnType<typeof useOidc>);
    localStorage.setItem('profileStore', '{}');
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: 'Ciao, Test User' })).toHaveAttribute('href', '/admin');
    await user.click(screen.getByRole('button', { name: 'Esci' }));
    expect(logout).toHaveBeenCalled();
    expect(localStorage.getItem('profileStore')).toBeNull();
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
