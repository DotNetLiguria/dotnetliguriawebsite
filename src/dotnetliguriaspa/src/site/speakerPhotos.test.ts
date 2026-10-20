import { photoCandidates } from './speakerPhotos';

vi.mock('virtual:content-photos', () => ({ default: ['profile/grace_hopper.png', 'speakers/ada_lovelace.jpg'] }));

describe('photoCandidates', () => {
  test('offers only the photos the website ships, after a usable record path', () => {
    expect(photoCandidates('Ada Lovelace', '/speakers/ada-portrait.jpg')).toEqual([
      expect.stringMatching(/\/Contents\/speakers\/ada-portrait\.jpg$/),
      expect.stringMatching(/\/Contents\/speakers\/ada_lovelace\.jpg$/),
    ]);
    expect(photoCandidates('Grace  Hopper')).toEqual([expect.stringMatching(/\/Contents\/profile\/grace_hopper\.png$/)]);
  });

  test('requests nothing for a speaker without a shipped photo or with a stale /Uploads path', () => {
    expect(photoCandidates('Alan Turing')).toEqual([]);
    expect(photoCandidates('Alan Turing', '/Uploads/speakers/alan.jpg')).toEqual([]);
  });

  test('managed removal disables shipped fallback and managed media URLs bypass /Contents', () => {
    expect(photoCandidates('Ada Lovelace', null, true)).toEqual([]);
    expect(photoCandidates('Ada Lovelace', '/api/media/photos/photo.webp', true)).toEqual([
      expect.stringMatching(/\/api\/media\/photos\/photo\.webp$/),
    ]);
    expect(photoCandidates('Ada Lovelace', '/api/media/photos/photo.webp', true)[0]).not.toContain('/Contents/');
  });
});
