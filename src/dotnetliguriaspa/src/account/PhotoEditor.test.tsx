import React from 'react';
import userEvent from '@testing-library/user-event';
import { fireEvent, jsonResponse, mockApi, render, screen, waitFor } from '../test-utils';
import { CapabilityContext } from './AccountCapabilities';
import PhotoEditor, { photoFileError, PhotoStatus } from './PhotoEditor';

const initial = (changes: Partial<PhotoStatus> = {}): PhotoStatus => ({
  version: 'v1', source: 'asset', url: null, previewPath: null, hasAccount: true,
  candidates: [{ key: 'account:copy', version: 'account-v1', label: 'foto account', url: null, previewPath: null }],
  affectedBoards: [], ...changes,
});
const user = () => userEvent.setup({ delay: null });

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

test.each(['board', 'speaker'] as const)('%s can copy an account photo independently, follow it, or remove only its own photo', async scope => {
  const writes: { path: string; body: unknown }[] = [];
  const changed = vi.fn();
  mockApi({
    [`photos/${scope}/p1/select`]: (path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { source: string };
      writes.push({ path, body });
      return jsonResponse(initial({ version: `v${writes.length + 1}`, source: body.source === 'existing' ? 'asset' : body.source as 'account' | 'none' }));
    },
    [`photos/${scope}/p1`]: initial(),
  });
  render(<PhotoEditor scope={scope} id="p1" onChanged={changed} />);
  await user().click(await screen.findByRole('button', { name: 'Copia foto account' }));
  await screen.findByText(/Foto aggiornata/);
  expect(writes[0].body).toEqual({ version: 'v1', source: 'existing', existingKey: 'account:copy', existingVersion: 'account-v1', confirmUnpublish: false });
  await user().click(screen.getByRole('button', { name: 'Segui la foto account' }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  expect(writes[1].body).toEqual({ version: 'v2', source: 'account', confirmUnpublish: false });
  await user().click(screen.getByRole('button', { name: 'Rimuovi foto da questa scheda' }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
  expect(writes[2].body).toEqual({ version: 'v3', source: 'none', confirmUnpublish: false });
  expect(writes.every(write => write.path.includes(`photos/${scope}/p1/`))).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/photos/account'))).toBe(false);
});

test('normal users remove account photos only after seeing affected Board names and explicitly confirming unpublishing', async () => {
  const writes: unknown[] = [];
  mockApi({
    'photos/account/select': (_path: string, init?: RequestInit) => { writes.push(JSON.parse(String(init?.body))); return jsonResponse(initial({ source: 'none', version: 'v2' })); },
    'photos/account': initial({ affectedBoards: ['Consiglio Genova', 'Consiglio La Spezia'] }),
  });
  render(<CapabilityContext.Provider value={{ status: 'ready', capabilities: { schemaVersion: 1, permissions: [], canAccessAdmin: false },
    clear: vi.fn(), refresh: vi.fn(), retry: vi.fn() }}><PhotoEditor scope="account" /></CapabilityContext.Provider>);
  await user().click(await screen.findByRole('button', { name: 'Rimuovi foto account' }));
  expect(writes).toHaveLength(0);
  expect(screen.getByText('Consiglio Genova')).toBeInTheDocument();
  expect(screen.getByText('Consiglio La Spezia')).toBeInTheDocument();
  expect(screen.getByText(/copie fisse restano invariate/i)).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Conferma rimozione foto account' });
  expect(confirm).toBeDisabled();
  await user().click(screen.getByRole('checkbox', { name: /Confermo di nascondere/ }));
  await user().click(confirm);
  await waitFor(() => expect(writes).toEqual([{ version: 'v1', source: 'none', confirmUnpublish: true }]));
});

test('account removal can be cancelled without writes and has a separate confirmation even without affected Boards', async () => {
  mockApi({ 'photos/account': initial() });
  render(<PhotoEditor scope="account" />);
  await user().click(await screen.findByRole('button', { name: 'Rimuovi foto account' }));
  expect(screen.getByText('Nessuna scheda Board verrà nascosta.')).toBeInTheDocument();
  await user().click(screen.getByRole('button', { name: 'Annulla rimozione foto' }));
  expect(screen.queryByRole('button', { name: 'Conferma rimozione foto account' })).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
});

test('published Board photo removal requires an explicit confirmation before unpublishing the affected Board', async () => {
  const writes: unknown[] = [];
  mockApi({
    'photos/board/b1/select': (_path: string, init?: RequestInit) => {
      writes.push(JSON.parse(String(init?.body)));
      return jsonResponse(initial({ source: 'none', version: 'v2', affectedBoards: [] }));
    },
    'photos/board/b1': initial({ affectedBoards: ['Consiglio Genova'] }),
  });
  const changed = vi.fn();
  render(<PhotoEditor scope="board" id="b1" onChanged={changed} />);
  const controls = user();
  await controls.click(await screen.findByRole('button', { name: 'Rimuovi foto da questa scheda' }));
  expect(writes).toHaveLength(0);
  expect(screen.getByText('Consiglio Genova')).toBeInTheDocument();
  expect(screen.getByText(/La foto account e gli altri profili restano invariati/)).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Conferma rimozione foto Board' });
  expect(confirm).toBeDisabled();
  await controls.click(screen.getByRole('checkbox', { name: /Confermo di nascondere/ }));
  await controls.click(screen.getByRole('button', { name: 'Annulla rimozione foto' }));
  expect(writes).toHaveLength(0);
  await controls.click(screen.getByRole('button', { name: 'Rimuovi foto da questa scheda' }));
  expect(screen.getByRole('checkbox', { name: /Confermo di nascondere/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Conferma rimozione foto Board' })).toBeDisabled();
  await controls.click(screen.getByRole('checkbox', { name: /Confermo di nascondere/ }));
  await controls.click(screen.getByRole('button', { name: 'Conferma rimozione foto Board' }));
  await waitFor(() => expect(writes).toEqual([{ version: 'v1', source: 'none', confirmUnpublish: true }]));
  expect(changed).toHaveBeenCalledOnce();
});

test('cancelling a local photo selection revokes its preview, restores file-input focus and never uploads', async () => {
  mockApi({ 'photos/speaker/s1': initial({ hasAccount: false, candidates: [] }) });
  render(<PhotoEditor scope="speaker" id="s1" />);
  const input = await screen.findByLabelText(/File JPEG/);
  const file = new File(['image'], 'photo.webp', { type: 'image/webp' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('img', { name: 'Anteprima del ritaglio' });
  fireEvent.change(screen.getByRole('slider', { name: /Dimensione ritaglio/ }), { target: { value: '.5' } });
  await user().click(screen.getByRole('button', { name: 'Annulla selezione foto' }));
  expect(screen.queryByRole('img', { name: 'Anteprima del ritaglio' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Carica e applica foto' })).not.toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-photo');
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole('slider', { name: /Dimensione ritaglio/ })).toHaveValue('1');
});

test('a linked account without a photo cannot be selected as a following source', async () => {
  mockApi({ 'photos/speaker/s1': initial({ hasAccount: true, candidates: [] }) });
  render(<PhotoEditor scope="speaker" id="s1" />);
  expect(await screen.findByRole('button', { name: 'Segui la foto account' })).toBeDisabled();
  expect(screen.getByText('Nessuna foto account disponibile da seguire.')).toBeInTheDocument();
});

test.each([
  [new File(['x'], 'bad.svg', { type: 'image/svg+xml' }), /JPEG, PNG o WebP/],
  [new File([], 'empty.jpg', { type: 'image/jpeg' }), /maggiore di zero/],
  [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }), /5 MiB/],
])('rejects invalid uploads before sending a request: $name', async (file, message) => {
  mockApi({ 'photos/speaker/s1': initial({ hasAccount: false }) });
  render(<PhotoEditor scope="speaker" id="s1" />);
  const input = await screen.findByLabelText(/File JPEG/);
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByRole('button', { name: 'Carica e applica foto' })).not.toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true);
});

test('accepts exactly 5 MiB JPEG PNG and WebP files', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    expect(photoFileError(new File([new Uint8Array(5 * 1024 * 1024)], 'photo', { type }))).toBe('');
  }
});

test('speaker without account uploads normalized crop as multipart and waits for a verified server response', async () => {
  let sent: RequestInit | undefined;
  let resolveUpload: (value: Response) => void = () => undefined;
  const response = new Promise<Response>(resolve => { resolveUpload = resolve; });
  mockApi({
    'photos/speaker/s1/upload': (_path: string, init?: RequestInit) => { sent = init; return response; },
    'photos/speaker/s1': initial({ hasAccount: false, candidates: [] }),
  });
  const changed = vi.fn();
  const rendered = render(<PhotoEditor scope="speaker" id="s1" onChanged={changed} />);
  const file = new File(['image'], 'photo.webp', { type: 'image/webp' });
  fireEvent.change(await screen.findByLabelText(/File JPEG/), { target: { files: [file] } });
  const preview = await screen.findByRole('img', { name: 'Anteprima del ritaglio' });
  Object.defineProperties(preview, { naturalWidth: { value: 800 }, naturalHeight: { value: 400 } });
  fireEvent.load(preview);
  fireEvent.change(screen.getByRole('slider', { name: /Posizione orizzontale/ }), { target: { value: '.25' } });
  fireEvent.change(screen.getByRole('slider', { name: /Posizione verticale/ }), { target: { value: '.75' } });
  fireEvent.change(screen.getByRole('slider', { name: /Dimensione ritaglio/ }), { target: { value: '.5' } });
  await user().click(screen.getByRole('button', { name: 'Carica e applica foto' }));
  await waitFor(() => expect(sent).toBeDefined());
  const body = sent?.body as FormData;
  expect(body.get('file')).toBe(file);
  expect(Object.fromEntries([...body.entries()].filter(([key]) => key !== 'file'))).toEqual({
    version: 'v1', cropX: '0.25', cropY: '0.75', cropSize: '0.5',
  });
  expect(new Headers(sent?.headers).has('Content-Type')).toBe(false);
  expect(screen.getByRole('progressbar', { name: 'Invio foto in corso' })).not.toHaveAttribute('value');
  expect(screen.queryByText(/Foto aggiornata/)).not.toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
  resolveUpload(jsonResponse(initial({ version: 'v2', hasAccount: false })));
  await screen.findByText(/Foto aggiornata/);
  expect(changed).toHaveBeenCalledOnce();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  rendered.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-photo');
});

test('authenticated previews are fetched as blobs and object URLs are revoked on unmount', async () => {
  mockApi({
    'photos/account/preview': () => new Response(new Blob(['webp'], { type: 'image/webp' })),
    'photos/account': initial({ previewPath: '/api/photos/account/preview', url: 'https://external.test/not-for-managed-preview' }),
  });

  const mounted = render(<PhotoEditor scope="account" />);
  expect(await screen.findByRole('img', { name: 'Foto attuale' })).toHaveAttribute('src', 'blob:private-photo');
  const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
  expect(urls.some(url => url.endsWith('/api/photos/account/preview'))).toBe(true);
  expect(urls.some(url => url.includes('?') || url.includes('external.test'))).toBe(false);
  mounted.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-photo');
});

test('Board editing shows historical photos using the same Contents URLs as the list and copies a speaker candidate', async () => {
  const writes: unknown[] = [];
  mockApi({
    'photos/board/b1/select': (_path: string, init?: RequestInit) => {
      writes.push(JSON.parse(String(init?.body)));
      return jsonResponse(initial({ version: 'v2', source: 'asset', url: '/Contents/speakers/ada.jpg', hasAccount: false, candidates: [] }));
    },
    'photos/board/b1': initial({
      source: 'legacy', url: '/profile/board.jpg', hasAccount: false,
      candidates: [{ key: 'speaker:s1', version: 'legacy', label: 'Relatore: Ada', url: '/Contents/speakers/ada.jpg', previewPath: null }],
    }),
  });
  render(<PhotoEditor scope="board" id="b1" />);
  expect(await screen.findByRole('img', { name: 'Foto attuale' })).toHaveAttribute('src', expect.stringMatching(/\/Contents\/profile\/board\.jpg$/));
  expect(screen.getByRole('img', { name: 'Anteprima Relatore: Ada' })).toHaveAttribute('src', expect.stringMatching(/\/Contents\/speakers\/ada\.jpg$/));
  await user().click(screen.getByRole('button', { name: 'Copia Relatore: Ada' }));
  await screen.findByText(/Foto aggiornata/);
  expect(writes).toEqual([{ version: 'v1', source: 'existing', existingKey: 'speaker:s1', existingVersion: 'legacy', confirmUnpublish: false }]);
  expect(screen.getByRole('img', { name: 'Foto attuale' })).toHaveAttribute('src', expect.stringMatching(/\/Contents\/speakers\/ada\.jpg$/));
});

test('a broken historical photo shows an explicit preview error', async () => {
  mockApi({ 'photos/board/b1': initial({ url: '/profile/missing.jpg', candidates: [] }) });
  render(<PhotoEditor scope="board" id="b1" />);
  fireEvent.error(await screen.findByRole('img', { name: 'Foto attuale' }));
  expect(screen.getByText('Anteprima non disponibile.')).toBeInTheDocument();
});

test('candidate previews use authenticated paths on the current role scope, preserving the opaque existingKey', async () => {
  mockApi({
    'photos/board/b1/image/128?existingKey=account%3Ahash': () => new Response(new Blob(['webp'], { type: 'image/webp' })),
    'photos/board/b1': initial({
      candidates: [{ key: 'account:hash', version: 'account-v3', label: 'foto account', url: null,
        previewPath: '/photos/board/b1/image/128?existingKey=account%3Ahash' }],
    }),
  });
  render(<PhotoEditor scope="board" id="b1" />);
  expect(await screen.findByRole('img', { name: 'Anteprima foto account' })).toHaveAttribute('src', 'blob:private-photo');
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/api/photos/board/b1/image/128?existingKey=account%3Ahash'))).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/photos/account/'))).toBe(false);
});

test('never fetches authenticated previews from external origins', async () => {
  mockApi({ 'photos/account': initial({ previewPath: 'https://external.test/private' }) });
  render(<PhotoEditor scope="account" />);
  expect(await screen.findByText('Anteprima non disponibile.')).toBeInTheDocument();
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('external.test'))).toBe(false);
});

test('failed writes never show success and require a fresh status before another selection', async () => {
  const changed = vi.fn();
  mockApi({
    'photos/board/b1/select': () => jsonResponse({ code: 'photo_changed_reload' }, 409),
    'photos/board/b1': initial(),
  });
  render(<PhotoEditor scope="board" id="b1" onChanged={changed} />);
  await user().click(await screen.findByRole('button', { name: 'Segui la foto account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Ricarica lo stato/);
  expect(screen.getByRole('alert')).toHaveTextContent('La foto o la sua fonte è cambiata.');
  expect(screen.queryByText(/Foto aggiornata/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Segui la foto account' })).not.toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
  await user().click(screen.getByRole('button', { name: 'Ricarica stato foto' }));
  expect(await screen.findByRole('button', { name: 'Segui la foto account' })).toBeEnabled();
});
