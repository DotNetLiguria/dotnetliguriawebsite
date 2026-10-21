import React from 'react';
import { render, screen, waitFor } from '../../test-utils';
import ServerPreview, { createPreviewDocument } from './ServerPreview';
import type { RenderedPreview } from './types';

const preview: RenderedPreview = {
  subject: 'Test', plainText: 'Testo', warnings: ['Controlla gli orari'],
  html: '<script>alert(1)</script><h1 onclick="alert(1)">Test</h1><img src="cid:logo"><img src="https://tracker.test/pixel"><img src="data:image/png;base64,AA=="><img src="cid:missing"><img srcset="https://tracker.test/a 2x" src="cid:logo"><a href="https://example.test" ping="https://tracker.test">Sito</a><a href="javascript:alert(1)">No</a><div style="background-image:url(https://tracker.test)">Test</div><iframe src="https://tracker.test"></iframe>',
  images: [{ cid: 'logo', contentType: 'image/png', base64: 'AA==' }],
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:local-only');
  URL.revokeObjectURL = vi.fn();
});

test('server HTML is sanitized, only supplied CID images become blobs, and CSP blocks all external loads', () => {
  const document = createPreviewDocument(preview);
  const dom = new DOMParser().parseFromString(document.html, 'text/html');
  expect(dom.querySelector('script,iframe,[onclick],[srcset],[ping]')).toBeNull();
  expect([...dom.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual(['blob:local-only', null, null, null, 'blob:local-only']);
  expect(dom.querySelector('div')?.getAttribute('style')).toBeNull();
  const link = dom.querySelector('a');
  expect(link?.getAttribute('href')).toBe('https://example.test');
  expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  expect(link?.getAttribute('target')).toBe('_blank');
  expect(dom.querySelectorAll('a')[1].getAttribute('href')).toBeNull();
  expect(dom.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'; img-src blob:");
  document.dispose();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-only');
});

test('preview iframe has no scripts/same-origin privileges, exposes text/warnings and releases old/new image URLs', async () => {
  const view = render(<ServerPreview preview={preview} />);
  await screen.findByTitle('Anteprima email isolata');
  const frame = screen.getByTitle('Anteprima email isolata');
  expect(frame).toHaveAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
  expect(frame).toHaveAttribute('referrerPolicy', 'no-referrer');
  expect(screen.getByText('Controlla gli orari')).toBeInTheDocument();
  expect(screen.getByText('Testo')).toBeInTheDocument();
  view.rerender(<ServerPreview preview={{ ...preview, html: '<p>Nuova revisione</p>' }} />);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

test('invalid image bytes fail visibly and release previously-created blobs', async () => {
  render(<ServerPreview preview={{ ...preview, images: [...preview.images, { cid: 'bad', contentType: 'image/jpeg', base64: '%%%%' }] }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile visualizzare');
  expect(screen.queryByTitle('Anteprima email isolata')).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-only');
});
