import React from 'react';
import { useLocation } from 'react-router-dom';
import { useOidc } from '@axa-fr/react-oidc';
import { mockApi, render, screen, waitFor, within } from '../../test-utils';
import App from '../../App';
import { resolveLegacyPath, workshopByOldUrl } from './legacyRoutes';

const GUID = '89D23964-F3CD-4CA8-9E65-D15251E0B6A1';
const guid = GUID.toLowerCase();

function Location() {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="indirizzo">{`${pathname}${search}${hash}`}</output>;
}
const renderApp = (route: string) => render(<><App /><Location /></>, { route });
const address = () => screen.getByLabelText('indirizzo').textContent;
const notFound = () => screen.queryByRole('heading', { level: 1, name: 'Pagina non trovata' });

describe('resolveLegacyPath', () => {
  test('maps the addresses of the previous site regardless of case', () => {
    expect(resolveLegacyPath('/Home', '')).toEqual({ to: '/' });
    expect(resolveLegacyPath('/home/Index/', '')).toEqual({ to: '/' });
    expect(resolveLegacyPath('/Home/About', '')).toEqual({ to: '/#team' });
    expect(resolveLegacyPath('/Workshops/Index', '')).toEqual({ to: '/workshops' });
    expect(resolveLegacyPath('/Workshops/Filter', '?Year=2024')).toEqual({ to: '/workshops?anno=2024' });
    expect(resolveLegacyPath('/workshops/filter', '?year=abc')).toEqual({ to: '/workshops' });
    expect(resolveLegacyPath('/Workshops/Detail', `?WorkshopId=${GUID}`)).toEqual({ to: `/workshop/${guid}`, workshopId: guid });
    expect(resolveLegacyPath('/Workshops/Detail', '?workshopid=non-un-guid')).toEqual({ to: '/workshops' });
    expect(resolveLegacyPath('/Home/Contact', '')).toBeNull();
    expect(resolveLegacyPath('/pagina-inesistente', '')).toBeNull();
  });

  test('finds the event whose OldUrl is the legacy address', () => {
    const list = [
      { workshopId: 'new-1', oldUrl: `https://dotnetliguria.net/Workshops/Detail?WorkshopId=${guid}` },
      { workshopId: 'new-2', oldUrl: 'non è un indirizzo' },
      { workshopId: 'new-3', oldUrl: null },
    ];
    expect(workshopByOldUrl(list, '/workshops/detail', `?workshopid=${GUID}`)).toBe('new-1');
    expect(workshopByOldUrl(list, '/Workshops/Detail', '?WorkshopId=altro')).toBeNull();
  });
});

describe('public fallback route', () => {
  test('redirects legacy event addresses, through OldUrl when the id changed', async () => {
    mockApi({ '/Workshop/Get?onlyPublished=true': [{ workshopId: 'nuovo-id', title: 'Evento', eventDate: '2024-01-10T00:00:00+01:00', oldUrl: `https://dotnetliguria.net/Workshops/Detail?WorkshopId=${guid}` }] });
    renderApp(`/Workshops/Detail?WorkshopId=${GUID}`);
    await waitFor(() => expect(address()).toBe('/workshop/nuovo-id'));
  });

  test('redirects a legacy event address to its direct equivalent when OldUrl says nothing', async () => {
    mockApi({ '/Workshop/Get': () => new Response('{}', { status: 500 }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(`/workshops/detail?workshopid=${guid}`);
    await waitFor(() => expect(address()).toBe(`/workshop/${guid}`));
  });

  test.each([
    ['/Workshops/Filter?Year=2024', '/workshops?anno=2024'],
    ['/Workshops/Index', '/workshops'],
    ['/Home/About', '/#team'],
    ['/Home/Index', '/'],
    ['/home', '/'],
  ])('redirects %s to %s', async (from, to) => {
    renderApp(from);
    await waitFor(() => expect(address()).toBe(to));
  });

  test('the archive answers its old capitalised address directly', async () => {
    renderApp('/Workshops');
    expect(await screen.findByRole('heading', { level: 1, name: 'Eventi passati' })).toBeInTheDocument();
  });

  test('unknown addresses, legacy or not, get the not-found page with noindex and the ways back', async () => {
    renderApp('/pagina-inesistente');
    expect(notFound()).toBeInTheDocument();
    expect(document.title).toBe('Pagina non trovata · DotNetLiguria');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    const main = screen.getByRole('main');
    expect(main).toContainElement(notFound());
    expect(within(main).getByRole('link', { name: 'Vai alla pagina iniziale' })).toHaveAttribute('href', '/');
    expect(within(main).getByRole('link', { name: 'Eventi passati' })).toHaveAttribute('href', '/workshops');
  });

  test('a legacy-looking address with no match is a not-found page after one lookup', async () => {
    mockApi({ '/Workshop/Get?onlyPublished=true': [{ workshopId: 'a', title: 'Evento', eventDate: '2024-01-10T00:00:00+01:00', oldUrl: 'https://dotnetliguria.net/Workshops/Detail?WorkshopId=a' }] });
    renderApp('/Home/Contact');
    expect(await screen.findByRole('heading', { level: 1, name: 'Pagina non trovata' })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/Workshop/Get?onlyPublished=true'))).toHaveLength(1);
  });

  test('never answers for the admin or the OIDC callbacks', () => {
    for (const route of ['/admin', '/admin/workshops/', '/authentication/callback', '/authentication/silent-callback']) {
      const { unmount } = renderApp(route);
      expect(notFound()).not.toBeInTheDocument();
      expect(screen.queryByRole('main')).not.toBeInTheDocument();
      unmount();
    }
  });

  test('keeps the admin screens when signed in', async () => {
    vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() } as unknown as ReturnType<typeof useOidc>);
    renderApp('/admin/venues/');
    expect(await screen.findByRole('heading', { name: 'Venues / Sale eventi' })).toBeInTheDocument();
    expect(notFound()).not.toBeInTheDocument();
  });
});
