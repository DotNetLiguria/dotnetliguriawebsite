import { renderHook } from '../../test-utils';
import { AdminApiError } from '../adminApi';
import { isSingleMailbox, useNewsletterBinary } from './newsletterApi';

test.each([
  ['single@example.test', true],
  ['single+tag@example.test', true],
  [' first@example.test', false],
  ['first@example.test,second@example.test', false],
  ['first@example.test;second@example.test', false],
  ['Name <single@example.test>', false],
  ['single@example.test\r\nBcc:other@example.test', false],
  ['invalid', false],
])('single mailbox validation: %s', (address, valid) => expect(isSingleMailbox(address)).toBe(valid));

test('binary authorization errors retain standard error detail and refresh capabilities', async () => {
  const invalidated = vi.fn();
  window.addEventListener('admin-permissions-denied', invalidated);
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: 'permission_denied', detail: 'Permesso revocato' }), { status: 403 }));
  const { result } = renderHook(() => useNewsletterBinary());
  await expect(result.current('/newsletters/n1/images', { method: 'POST', body: new FormData() })).rejects.toEqual(expect.objectContaining<Partial<AdminApiError>>({ status: 403, code: 'permission_denied', detail: 'Permesso revocato' }));
  expect(invalidated).toHaveBeenCalledOnce();
  const init = vi.mocked(fetch).mock.calls[0][1];
  expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  expect(init?.cache).toBe('no-store');
  window.removeEventListener('admin-permissions-denied', invalidated);
});
