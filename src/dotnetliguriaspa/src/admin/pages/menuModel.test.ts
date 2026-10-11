import { isMenuUrl, menuUrlError } from './menuModel';

describe('menu model helpers', () => {
  test('addresses are pages of the site or full http(s) links', () => {
    for (const value of ['/', '/workshops', '/#team', '/workshop/abc?x=1', 'https://example.test/page']) expect(isMenuUrl(value)).toBe(true);
    for (const value of ['workshops', '//evil.example.test', 'javascript:alert(1)', '/two words', '', undefined]) expect(isMenuUrl(value)).toBe(false);
  });

  test('explains what is wrong with an address', () => {
    expect(menuUrlError('   ')).toBe("L'indirizzo è obbligatorio.");
    expect(menuUrlError('workshops')).toMatch(/Indica una pagina del sito/);
    expect(menuUrlError('/workshops')).toBeNull();
  });
});
