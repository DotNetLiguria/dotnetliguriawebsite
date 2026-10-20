import { renderHook, waitFor } from '../test-utils';
import { AdminSpeaker, resetPhotoCache, useSpeakerPhotos } from './adminApi';

vi.mock('virtual:content-photos', () => ({ default: ['speakers/ada_lovelace.jpg'] }));

beforeEach(() => resetPhotoCache());

test('managed removals make no legacy HEAD requests even when a shipped speaker portrait exists', async () => {
  const speakers: AdminSpeaker[] = [{ workshopSpeakerId: 's1', name: 'Ada Lovelace', profileImageUrl: null, photoFallbackDisabled: true }];
  const { result } = renderHook(() => useSpeakerPhotos(speakers));
  await waitFor(() => expect(result.current?.get('s1')).toBeNull());
  expect(fetch).not.toHaveBeenCalled();
});

test('managed media paths bypass Contents and cache entries are invalidated when fallback policy changes', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response(null, { headers: { 'Content-Type': 'image/webp' } }));
  const initial: AdminSpeaker[] = [{ workshopSpeakerId: 's1', name: 'Ada Lovelace', profileImageUrl: '/api/media/photos/a.webp', photoFallbackDisabled: true }];
  const { result, rerender } = renderHook(({ speakers }: { speakers: AdminSpeaker[] }) => useSpeakerPhotos(speakers), { initialProps: { speakers: initial } });
  await waitFor(() => expect(result.current?.get('s1')).toMatch(/\/api\/media\/photos\/a\.webp$/));
  expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain('/Contents/');
  rerender({ speakers: [{ ...initial[0], profileImageUrl: null, photoFallbackDisabled: false }] });
  await waitFor(() => expect(result.current?.get('s1')).toMatch(/\/Contents\/speakers\/ada_lovelace\.jpg$/));
  rerender({ speakers: [{ ...initial[0], profileImageUrl: null, photoFallbackDisabled: true }] });
  await waitFor(() => expect(result.current?.get('s1')).toBeNull());
  expect(fetch).toHaveBeenCalledTimes(2);
});
