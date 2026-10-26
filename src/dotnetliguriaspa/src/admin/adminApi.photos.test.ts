import { renderHook, waitFor } from '../test-utils';
import { AdminSpeaker, resetPhotoCache, useSpeakerPhotos } from './adminApi';

beforeEach(() => resetPhotoCache());

test('a speaker without a selected photo makes no HEAD request', async () => {
  const speakers: AdminSpeaker[] = [{ workshopSpeakerId: 's1', name: 'Ada Lovelace', profileImageUrl: null, photoFallbackDisabled: true }];
  const { result } = renderHook(() => useSpeakerPhotos(speakers));
  await waitFor(() => expect(result.current?.get('s1')).toBeNull());
  expect(fetch).not.toHaveBeenCalled();
});

test('managed media paths bypass Contents and a removed photo stays removed', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response(null, { headers: { 'Content-Type': 'image/webp' } }));
  const initial: AdminSpeaker[] = [{ workshopSpeakerId: 's1', name: 'Ada Lovelace', profileImageUrl: '/api/media/photos/a.webp', photoFallbackDisabled: true }];
  const { result, rerender } = renderHook(({ speakers }: { speakers: AdminSpeaker[] }) => useSpeakerPhotos(speakers), { initialProps: { speakers: initial } });
  await waitFor(() => expect(result.current?.get('s1')).toMatch(/\/api\/media\/photos\/a\.webp$/));
  expect(vi.mocked(fetch).mock.calls[0][0]).not.toContain('/Contents/');
  rerender({ speakers: [{ ...initial[0], profileImageUrl: null, photoFallbackDisabled: false }] });
  await waitFor(() => expect(result.current?.get('s1')).toBeNull());
  expect(fetch).toHaveBeenCalledTimes(1);
});
