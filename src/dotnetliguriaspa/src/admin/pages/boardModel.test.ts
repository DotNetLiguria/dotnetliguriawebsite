import { contentUrl } from '../../site/siteApi';
import { boardPhoto, isWebUrl, linkError } from './boardModel';

describe('board model helpers', () => {
  test('only http(s) addresses are valid links', () => {
    expect(isWebUrl('https://www.linkedin.com/in/someone')).toBe(true);
    expect(isWebUrl('  http://blogs.example.test/raf ')).toBe(true);
    for (const value of ['javascript:alert(1)', 'ftp://example.test', 'www.example.test', 'https://', '', undefined]) expect(isWebUrl(value)).toBe(false);
    expect(linkError('')).toBeNull();
    expect(linkError('https://github.com/x')).toBeNull();
    expect(linkError('github.com/x')).toBe('Indica un indirizzo che inizi con http:// o https://.');
  });

  test('photos resolve under /Contents, tolerating full addresses and a repeated Contents prefix', () => {
    expect(boardPhoto(null)).toBeNull();
    const expected = contentUrl('profile/alberto-baroni.jpg');
    expect(expected).toMatch(/\/Contents\/profile\/alberto-baroni\.jpg$/);
    expect(boardPhoto('profile/alberto-baroni.jpg')).toBe(expected);
    expect(boardPhoto('/profile/alberto-baroni.jpg')).toBe(expected);
    expect(boardPhoto('Contents/profile/alberto-baroni.jpg')).toBe(expected);
    expect(boardPhoto('https://cdn.example.test/a.jpg')).toBe('https://cdn.example.test/a.jpg');
    expect(boardPhoto('/api/media/photos/a.webp')).toMatch(/\/api\/media\/photos\/a\.webp$/);
    expect(boardPhoto('/api/media/photos/a.webp')).not.toContain('/Contents/');
  });
});
