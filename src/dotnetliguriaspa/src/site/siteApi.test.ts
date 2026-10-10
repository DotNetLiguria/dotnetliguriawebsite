import { jsonResponse, mockApi } from '../test-utils';
import { API_BASE_URL } from '../config/apiConfig';
import { SiteApiError, getFeaturedWorkshop, getWorkshop } from './siteApi';

const ID = '89d23964-f3cd-4ca8-9e65-d15251e0b6a1';
const workshop = (workshopId: string, title: string) => ({ workshopId, title, eventDate: '2025-06-12T00:00:00+02:00' });

describe('site API client', () => {
  test('treats a missing featured workshop as no event, and other failures as errors', async () => {
    mockApi({ '/Workshop/GetInHomePage/HomePage': () => jsonResponse({ status: 404 }, 404) });
    await expect(getFeaturedWorkshop()).resolves.toBeNull();

    mockApi({ '/Workshop/GetInHomePage/HomePage': () => jsonResponse({}, 500) });
    await expect(getFeaturedWorkshop()).rejects.toThrow(new SiteApiError(500));
  });

  test('falls back to the published list when the single-workshop lookup answers 404', async () => {
    mockApi({
      [`/Workshop/Get/${ID.toUpperCase()}`]: () => jsonResponse({ status: 404 }, 404),
      '/Workshop/Get?onlyPublished=true': [workshop('other', 'Altro'), workshop(ID, 'AI Generativa')],
    });
    await expect(getWorkshop(ID.toUpperCase())).resolves.toMatchObject({ title: 'AI Generativa' });
    expect(fetch).toHaveBeenLastCalledWith(`${API_BASE_URL}/Workshop/Get?onlyPublished=true`, expect.any(Object));
  });

  test('does not call the API for ids that are not GUIDs and rethrows server errors', async () => {
    await expect(getWorkshop('non-esiste')).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    mockApi({ [`/Workshop/Get/${ID}`]: () => jsonResponse({}, 503) });
    await expect(getWorkshop(ID)).rejects.toThrow('Errore HTTP: 503');
  });
});
