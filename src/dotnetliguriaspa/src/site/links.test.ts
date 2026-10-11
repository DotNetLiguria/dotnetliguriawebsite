import { webUrl } from './links';

describe('webUrl', () => {
  test('keeps web addresses and completes bare domains with https', () => {
    expect(webUrl('https://www.linkedin.com/in/x')).toBe('https://www.linkedin.com/in/x');
    expect(webUrl('http://blog.example.test/')).toBe('http://blog.example.test/');
    expect(webUrl(' linkedin.com/in/x ')).toBe('https://linkedin.com/in/x');
    expect(webUrl('www.github.com/x')).toBe('https://www.github.com/x');
    expect(webUrl('//x.example.test/prima')).toBe('https://x.example.test/prima');
  });

  test('rejects anything that is not a web address', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.test', 'ftp://files.example.test', 'solo testo', 'a@b.test', '', null, undefined]) {
      expect(webUrl(value)).toBeNull();
    }
  });
});
