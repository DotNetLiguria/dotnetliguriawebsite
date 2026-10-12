import { render, screen, waitFor, within, makeWorkshop } from './test-utils';
import userEvent from '@testing-library/user-event';
import { useOidc } from '@axa-fr/react-oidc';
import { AxiosError } from 'axios';
import App from './App';
import axiosClient from './utility/axiosClient';
import { userProfileLocalStorageStore } from './store/userProfileLocalStorageStore';
import { getWorkshops, getWorkshopsByYear, getWorkshopById } from './services/workShopService';
import { API_BASE_URL, CONTENT_BASE_URL } from './config/apiConfig';

test('public home renders the community and offers login', async () => {
  vi.mocked(fetch).mockImplementation(async url => new Response(JSON.stringify(
    String(url).endsWith('/Workshop/GetInHomePage/HomePage') ? makeWorkshop() : []
  ), { status: 200 }));
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'La community .NET della Liguria' })).toBeInTheDocument();
  // The featured card in the hero and the evidence section both present the event at level 2.
  expect(await screen.findAllByRole('heading', { level: 2, name: 'Test Workshop' })).toHaveLength(2);
  const login = useOidc().login;
  await userEvent.click(screen.getByRole('button', { name: 'Area Personale' }));
  expect(login).toHaveBeenCalledWith('/admin');
});

test('public home renders an empty state when a fresh database has no featured workshop', async () => {
  vi.mocked(fetch).mockImplementation(async url => new Response(JSON.stringify(
    String(url).endsWith('/Workshop/GetInHomePage/HomePage') ? { status: 404 } : []
  ), { status: String(url).endsWith('/Workshop/GetInHomePage/HomePage') ? 404 : 200 }));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Il prossimo incontro è in preparazione' })).toBeInTheDocument();
  expect(screen.getByText('Nessun evento pubblicato.')).toBeInTheDocument();
  expect(screen.queryByText('Caricamento del prossimo evento…')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('public home reports server failures instead of presenting an empty database', async () => {
  const report = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(fetch).mockImplementation(async url => new Response(JSON.stringify([]), {
    status: String(url).endsWith('/Workshop/GetInHomePage/HomePage') ? 500 : 200,
  }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Errore HTTP: 500');
  expect(screen.queryByText('Nessun evento disponibile.')).not.toBeInTheDocument();
  expect(report).toHaveBeenCalled();
});

test.each([
  ['/admin', 'Ciao, Test'], ['/admin/profile/', 'Profilo'],
  ['/admin/workshops/', 'Eventi'], ['/admin/speakers/', 'Relatori'],
  ['/admin/board/', 'Board'], ['/admin/venues/', 'Sedi'],
  ['/admin/feedbacks', 'Questionari'], ['/admin/questionnaires', 'Questionari'],
  ['/admin/topmenu/', 'Menu del sito'], ['/admin/downloads', 'Backup e import'], ['/admin/import-export/', 'Backup e import'],
])('authenticated route %s retains its screen', async (route, heading) => {
  userProfileLocalStorageStore.getState().setProfileSaved(true);
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
  const routeWarnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<App />, { route });
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  expect(routeWarnings).not.toHaveBeenCalledWith(expect.stringContaining('No routes matched location'));
  const sections = screen.getByRole('navigation', { name: 'Sezioni' });
  expect(within(sections).getByRole('link', { name: 'Panoramica' })).toHaveAttribute('href', '/admin');
  expect(screen.getByRole('button', { name: /^Menu di Test User/ })).toBeInTheDocument();
});

test('unauthenticated sessions clear persisted profile and are asked to sign in instead of seeing admin routes', async () => {
  const login = vi.fn();
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: false, login, logout: vi.fn(), renewTokens: vi.fn() });
  localStorage.setItem('profileStore', JSON.stringify({ state: { profileSaved: true }, version: 0 }));
  render(<App />, { route: '/admin/speakers/?filtro=senza-foto' });
  expect(localStorage.getItem('profileStore')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Area riservata' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Sezioni' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Accedi' }));
  expect(login).toHaveBeenCalledWith('/admin/speakers/?filtro=senza-foto');
});

test('unknown admin addresses stay in the admin: sign-in without a session, not-found page with one', async () => {
  const { unmount } = render(<App />, { route: '/admin/sezione-inesistente' });
  expect(screen.getByRole('heading', { name: 'Area riservata' })).toBeInTheDocument();
  unmount();
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
  render(<App />, { route: '/admin/sezione-inesistente' });
  expect(screen.getByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Vai alla panoramica/ })).toHaveAttribute('href', '/admin');
});

test('the questionnaire sidebar link opens the new questionnaire screen', async () => {
  userProfileLocalStorageStore.getState().setProfileSaved(true);
  vi.mocked(useOidc).mockReturnValue({ isAuthenticated: true, login: vi.fn(), logout: vi.fn(), renewTokens: vi.fn() });
  render(<App />, { route: '/admin' });
  const link = within(screen.getByRole('navigation', { name: 'Sezioni' })).getByRole('link', { name: 'Questionari' });
  expect(link).toHaveAttribute('href', '/admin/questionnaires');
  expect(screen.queryByRole('link', { name: /feedback/i })).not.toBeInTheDocument();
  await userEvent.click(link);
  expect(await screen.findByRole('heading', { name: 'Questionari' })).toBeInTheDocument();
});

test('profile store persists confirmation and can be reset', () => {
  userProfileLocalStorageStore.getState().setProfileSaved(true);
  expect(JSON.parse(localStorage.getItem('profileStore')).state.profileSaved).toBe(true);
  userProfileLocalStorageStore.getState().setProfileSaved(false);
  expect(userProfileLocalStorageStore.getState().profileSaved).toBe(false);
});

test.each([null, 'synthetic-fallback'])('Axios sends a fallback token only when supplied (%s)', async token => {
  const client = axiosClient(token);
  const adapter = vi.fn(async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }));
  client.defaults.adapter = adapter;
  await client.get('/test');
  expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe(token ? `Bearer ${token}` : undefined);
});

test('stored access token takes priority over a caller token', async () => {
  localStorage.setItem('ACCESS_TOKEN', 'synthetic-stored');
  const client = axiosClient('synthetic-fallback');
  client.defaults.adapter = async config => {
    expect(config.headers.get('Authorization')).toBe('Bearer synthetic-stored');
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await client.get('/test');
});

test.each([401, 403])('Axios rejects HTTP %s and clears only unauthorized credentials', async status => {
  localStorage.setItem('ACCESS_TOKEN', 'synthetic-stored');
  const client = axiosClient();
  client.defaults.adapter = async config => {
    throw new AxiosError('HTTP failure', 'ERR_BAD_REQUEST', config, undefined, { data: {}, status, statusText: 'Failure', headers: {}, config });
  };
  await expect(client.get('/test')).rejects.toBeInstanceOf(AxiosError);
  expect(localStorage.getItem('ACCESS_TOKEN')).toBe(status === 401 ? null : 'synthetic-stored');
});

test('workshop requests preserve published filtering and year routes', async () => {
  await getWorkshops();
  expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/Workshop/Get?onlyPublished=true`, expect.objectContaining({ method: 'GET' }));
  await getWorkshopsByYear(2024);
  expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/Workshop/GetByYear/2024?onlyPublished=true`, expect.objectContaining({ method: 'GET' }));
  expect(CONTENT_BASE_URL).toMatch(/\/Contents\/$/);
});

test.each([404, 500])('workshop detail rejects HTTP %s instead of returning a success payload', async status => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status }));
  await expect(getWorkshopById('missing')).rejects.toThrow(status === 404 ? 'Workshop with ID missing not found' : 'HTTP error! status: 500');
});
