import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { CapabilityContext } from '../../account/AccountCapabilities';
import type { Permission } from '../../account/permissions';
import NewsletterEditorPage from './NewsletterEditorPage';
import NewsletterListPage from './NewsletterListPage';
import type { Newsletter, NewsletterConfig, NewsletterPreview } from './types';

const initial: Newsletter = { id: 'n1', kind: 'generic', title: 'Notizie della community', subject: 'Novità', markdown: 'Testo iniziale', version: 3, archived: false, productionStatus: 'draft', updatedAt: '2026-10-21T09:00:00Z' };
const config: NewsletterConfig = { defaultTestAddress: 'prova@example.test', distributionAddress: 'lista@example.test', testEnabled: true, productionEnabled: true, maxImageBytes: 1024 };
const preview: NewsletterPreview = { snapshotId: 'snapshot-3', contentHash: 'hash-3', subject: initial.subject, html: '<h1>Novità</h1>', plainText: 'Novità', images: [], warnings: [], messageBytes: 456 };
const full: Permission[] = ['newsletters.read', 'newsletters.manage', 'newsletters.send'];
type Handler = (path: string, init: RequestInit) => Response | Promise<Response> | undefined;

function serve(handler?: Handler, configuration = config, record = initial) {
  const requests: { path: string; init: RequestInit }[] = [];
  vi.mocked(fetch).mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input), 'https://localhost');
    const path = url.pathname.replace(/^\/api/, '') + url.search;
    requests.push({ path, init });
    if (handler) {
      const custom = await handler(path, init);
      if (custom) return custom;
    }
    if (path === '/newsletters/config') return jsonResponse(configuration);
    if (path === '/newsletters/events') return jsonResponse([{ id: 'e1', title: 'Evento futuro pubblicato', date: '2026-11-01', locationName: 'Genova' }]);
    if (path === '/newsletter-templates') return jsonResponse([{ id: 't1', kind: record.kind, name: 'Modello base', subject: 'Generato', markdown: 'Testo generato', version: 2, archived: false }]);
    if (path === '/newsletters/n1/history') return jsonResponse([]);
    if (path === '/newsletters/n1/preview') return jsonResponse(preview);
    if (path === '/newsletters/n1/test') return jsonResponse({ id: 'a1', mode: 'test', recipient: 'prova@example.test', status: 'accepted', occurredAt: '2026-10-21T09:01:00Z' });
    if (path === '/newsletters/n1/confirmation') return jsonResponse({ confirmationId: 'confirm-3', expiresAt: '2026-10-21T09:10:00Z', distributionAddress: config.distributionAddress });
    if (path === '/newsletters/n1' && !init.method) return jsonResponse(record);
    throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${path}`);
  });
  return { requests, to: (path: string, method = 'POST') => requests.filter(value => value.path === path && (value.init.method ?? 'GET') === method) };
}

function mount(permissions = full, route = '/admin/newsletters/n1') {
  return render(<CapabilityContext.Provider value={{
    status: 'ready', capabilities: { schemaVersion: 1, permissions, canAccessAdmin: true },
    retry: vi.fn(), refresh: vi.fn(), clear: vi.fn(),
  }}><Routes>
    <Route path="/admin/newsletters/new" element={<NewsletterEditorPage />} />
    <Route path="/admin/newsletters/:id" element={<NewsletterEditorPage />} />
    <Route path="/admin/newsletters" element={<NewsletterListPage />} />
  </Routes></CapabilityContext.Provider>, { route });
}

const user = () => userEvent.setup({ delay: null, pointerEventsCheck: 0 });
const prepare = async () => {
  await user().click(await screen.findByRole('button', { name: 'Prepara anteprima' }));
  await screen.findByTitle('Anteprima email isolata');
};
const testAndApprove = async () => {
  await prepare();
  await user().click(screen.getByRole('button', { name: 'Invia prova' }));
  await screen.findByText(/Prova di questo snapshot accettata/);
  await user().click(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ }));
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:newsletter-test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

test('manual save sends the exact persisted version; 409 preserves all local edits and warns on navigation', async () => {
  const api = serve((path, init) => {
    if (path === '/newsletters/n1' && init.method === 'PUT') return jsonResponse({ detail: 'version conflict' }, 409);
    return undefined as unknown as Response;
  });
  mount();
  const subject = await screen.findByRole('textbox', { name: 'Oggetto email' });
  fireEvent.change(subject, { target: { value: 'Oggetto modificato' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Contenuto Markdown' }), { target: { value: 'Testo personale' } });
  expect(api.to('/newsletters/n1', 'PUT')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Prepara anteprima' })).toBeDisabled();
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await user().click(screen.getByRole('link', { name: 'Newsletter' }));
  expect(confirm).toHaveBeenCalled();
  expect(subject).toBeInTheDocument();
  await user().click(screen.getByRole('button', { name: 'Salva bozza' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert')).toHaveTextContent('Conflitto di versione');
  expect(subject).toHaveValue('Oggetto modificato');
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveValue('Testo personale');
  expect(JSON.parse(String(api.to('/newsletters/n1', 'PUT')[0].init.body))).toEqual({ version: 3, title: initial.title, subject: 'Oggetto modificato', markdown: 'Testo personale' });
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
});

test('sender requires current snapshot test, visual approval and final explicit confirmation with server destination', async () => {
  const api = serve(path => path === '/newsletters/n1/send'
    ? jsonResponse({ id: 'p1', mode: 'production', recipient: config.distributionAddress, status: 'accepted', occurredAt: '2026-10-21T09:03:00Z' })
    : undefined as unknown as Response);
  mount(['newsletters.read', 'newsletters.send']);
  await screen.findByRole('textbox', { name: 'Oggetto email' });
  expect(screen.getByRole('textbox', { name: 'Oggetto email' })).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'Salva bozza' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ })).toBeDisabled();
  expect(await screen.findByRole('textbox', { name: 'Destinatario della prova' })).toHaveValue(config.defaultTestAddress);
  await prepare();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
  const address = screen.getByRole('textbox', { name: 'Destinatario della prova' });
  fireEvent.change(address, { target: { value: 'alternativa@example.test' } });
  await user().click(screen.getByRole('button', { name: 'Invia prova' }));
  await screen.findByText(/Prova di questo snapshot accettata/);
  expect(JSON.parse(String(api.to('/newsletters/n1/test')[0].init.body))).toEqual({ version: 3, snapshotId: preview.snapshotId, recipient: 'alternativa@example.test' });
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
  await user().click(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ }));
  await user().click(screen.getByRole('button', { name: 'Prepara conferma invio' }));
  const dialog = await screen.findByRole('dialog', { name: 'Conferma finale di invio in produzione' });
  expect(dialog).toHaveTextContent(config.distributionAddress);
  expect(dialog).toHaveTextContent(initial.title);
  expect(api.to('/newsletters/n1/send')).toHaveLength(0);
  expect(JSON.parse(String(api.to('/newsletters/n1/confirmation')[0].init.body))).toEqual({ version: 3, snapshotId: preview.snapshotId, visualApproved: true });
  await user().click(within(dialog).getByRole('button', { name: 'Confermo: invia all’appliance SMTP' }));
  await screen.findByText(/Accettata dall’appliance SMTP, non necessariamente consegnata/);
  expect(api.to('/newsletters/n1/send')).toHaveLength(1);
  expect(JSON.parse(String(api.to('/newsletters/n1/send')[0].init.body))).toEqual({ version: 3, snapshotId: preview.snapshotId, confirmationId: 'confirm-3' });
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
});

test('edits invalidate preview, successful test and visual approval even if the original text is restored', async () => {
  serve();
  mount();
  await testAndApprove();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Oggetto email' }), { target: { value: 'Modifica' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Oggetto email' }), { target: { value: initial.subject } });
  expect(screen.queryByTitle('Anteprima email isolata')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
});

test.each(['preview', 'test'])('late %s response after an edit cannot restore send eligibility', async operation => {
  let resolve!: (response: Response) => void;
  serve(path => path === `/newsletters/n1/${operation}` ? new Promise<Response>(done => { resolve = done; }) : undefined as unknown as Response);
  mount();
  if (operation === 'test') await prepare();
  await user().click(await screen.findByRole('button', { name: operation === 'test' ? 'Invia prova' : 'Prepara anteprima' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Oggetto email' }), { target: { value: 'Nuova revisione locale' } });
  await act(async () => resolve(jsonResponse(operation === 'preview' ? preview : { id: 'a1', status: 'accepted' })));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Oggetto email' })).toHaveValue('Nuova revisione locale'));
  expect(screen.queryByTitle('Anteprima email isolata')).not.toBeInTheDocument();
  expect(screen.queryByText(/Prova di questo snapshot accettata/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
});

test.each(['rejected', 'unknown'])('a %s test is visibly not approval and cannot authorize production', async status => {
  serve(path => path === '/newsletters/n1/test' ? jsonResponse({ id: 'a1', status, errorCode: 'smtp_result' }) : undefined as unknown as Response);
  mount();
  await prepare();
  await user().click(screen.getByRole('button', { name: 'Invia prova' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Prova non accettata');
  expect(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
});

test('generation is explicit, confirms replacement and uses saved version and selected template', async () => {
  const api = serve(path => path === '/newsletters/n1/generate' ? jsonResponse({ ...initial, subject: 'Generato', markdown: 'Dal template', version: 4, templateId: 't1' }) : undefined as unknown as Response);
  mount();
  await screen.findByRole('textbox', { name: 'Oggetto email' });
  await user().selectOptions(await screen.findByRole('combobox', { name: 'Template' }), 't1');
  expect(api.to('/newsletters/n1/generate')).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Genera e sostituisci testo' }));
  const dialog = await screen.findByRole('dialog', { name: 'Sostituire il testo della newsletter?' });
  expect(dialog).toHaveTextContent('sostituiti');
  expect(api.to('/newsletters/n1/generate')).toHaveLength(0);
  await user().click(within(dialog).getByRole('button', { name: 'Sostituisci e salva' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Oggetto email' })).toHaveValue('Generato'));
  expect(JSON.parse(String(api.to('/newsletters/n1/generate')[0].init.body))).toEqual({ version: 3, templateId: 't1' });
});

test('a new event newsletter generates text before saving and selects the only matching template', async () => {
  const api = serve(path => {
    if (path === '/newsletter-templates') return jsonResponse([{ id: 'event-template', kind: 'event', name: 'Annuncio evento', subject: '{{event.title}}', markdown: 'Template', version: 2, archived: false }]);
    if (path === '/newsletter-templates/event-template/preview') return jsonResponse({ subject: 'Evento futuro pubblicato', markdown: '## Testo generato', html: '<p>Testo generato</p>', plainText: 'Testo generato', images: [], warnings: [] });
    return undefined;
  });
  mount(full, '/admin/newsletters/new');
  await user().selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'event');
  await screen.findByRole('option', { name: /Evento futuro pubblicato/ });
  await user().selectOptions(screen.getByRole('combobox', { name: 'Evento pubblicato in corso o futuro' }), 'e1');
  expect(screen.getByRole('textbox', { name: 'Titolo interno' })).toHaveValue('Evento futuro pubblicato');
  expect(screen.getByRole('textbox', { name: 'Oggetto email' })).toHaveValue('Evento futuro pubblicato');
  expect(screen.getByRole('heading', { name: 'Genera da un template' }).compareDocumentPosition(
    screen.getByRole('textbox', { name: 'Titolo interno' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Template' })).toHaveValue('event-template'));
  const button = screen.getByRole('button', { name: 'Genera e sostituisci testo' });
  expect(button).toBeEnabled();
  await user().click(button);
  await user().click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Genera testo' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveValue('## Testo generato'));
  expect(screen.getByRole('textbox', { name: 'Titolo interno' })).toHaveValue('Evento futuro pubblicato');
  expect(screen.getByRole('textbox', { name: 'Oggetto email' })).toHaveValue('Evento futuro pubblicato');
  expect(JSON.parse(String(api.to('/newsletter-templates/event-template/preview')[0].init.body))).toEqual({ version: 2, eventId: 'e1' });
  expect(api.to('/newsletters')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Salva bozza' })).toBeEnabled();
});

test('generation explains when an existing edited draft must first be saved', async () => {
  serve();
  mount();
  const title = await screen.findByRole('textbox', { name: 'Titolo interno' });
  fireEvent.change(title, { target: { value: 'Modifica locale' } });
  await screen.findByText('Salva le modifiche alla bozza prima di sostituire il testo.');
  expect(screen.getByRole('button', { name: 'Genera e sostituisci testo' })).toBeDisabled();
});

test('read-only and editor-only accounts cannot send; no-read accounts mount no private data', async () => {
  const api = serve();
  const view = mount(['newsletters.read']);
  await screen.findByRole('textbox', { name: 'Oggetto email' });
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'Salva bozza' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
  expect(api.to('/newsletter-templates', 'GET')).toHaveLength(0);
  expect(api.to('/newsletters/events', 'GET')).toHaveLength(0);
  view.unmount();
  const editor = mount(['newsletters.read', 'newsletters.manage']);
  await prepare();
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
  editor.unmount();
  const previous = api.requests.length;
  mount(['newsletters.manage', 'newsletters.send']);
  expect(screen.getByRole('alert')).toHaveTextContent('Non disponi del permesso');
  expect(api.requests).toHaveLength(previous);
});

test('test recipient accepts exactly one editable address, never the configured distribution', async () => {
  const api = serve();
  mount();
  await prepare();
  const input = screen.getByRole('textbox', { name: 'Destinatario della prova' });
  for (const value of ['one@example.test,two@example.test', 'one@example.test;two@example.test', config.distributionAddress, 'invalid']) {
    fireEvent.change(input, { target: { value } });
    expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scarica .eml di prova' })).toBeDisabled();
  }
  expect(api.to('/newsletters/n1/test')).toHaveLength(0);
  fireEvent.change(input, { target: { value: 'single@example.test' } });
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeEnabled();
});

test('multipart upload inserts the server markdown without a JSON Content-Type; invalid files never leave browser', async () => {
  const api = serve(path => path === '/newsletters/n1/images' ? jsonResponse({ id: 'image1', markdown: '![Descrizione](newsletter-image:image1)' }) : undefined as unknown as Response);
  mount();
  const fileInput = await screen.findByLabelText(/Carica immagine PNG/);
  fireEvent.change(fileInput, { target: { files: [new File(['large'], 'photo.png', { type: 'image/png' })] } });
  await waitFor(() => expect((screen.getByRole('textbox', { name: 'Contenuto Markdown' }) as HTMLTextAreaElement).value).toContain('newsletter-image:image1'));
  const upload = api.to('/newsletters/n1/images')[0].init;
  expect(upload.body).toBeInstanceOf(FormData);
  expect(new Headers(upload.headers).has('Content-Type')).toBe(false);
  expect(new Headers(upload.headers).get('X-Admin-Request')).toBe('true');
  fireEvent.change(fileInput, { target: { files: [new File(['x'.repeat(2048)], 'huge.png', { type: 'image/png' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('entro il limite');
  expect(api.to('/newsletters/n1/images')).toHaveLength(1);
});

test('EML downloads use test snapshot and chosen recipient, release blob URL and do not count as a test', async () => {
  const api = serve(path => path.startsWith('/newsletters/n1/eml?') ? new Response('MIME test message', { headers: { 'Content-Type': 'message/rfc822' } }) : undefined as unknown as Response);
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  mount();
  await prepare();
  await user().click(screen.getByRole('button', { name: 'Scarica .eml di prova' }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(api.requests.find(value => value.path.includes('/eml?'))?.path).toContain('snapshotId=snapshot-3&recipient=prova%40example.test');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:newsletter-test');
  expect(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ })).toBeDisabled();
  expect(api.to('/newsletters/n1/test')).toHaveLength(0);
});

test('production-disabled configuration is explicit even after a successful test', async () => {
  const api = serve(undefined, { ...config, productionEnabled: false });
  mount();
  await testAndApprove();
  expect(screen.getByText(/Invio in produzione disabilitato dalla configurazione/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
  expect(api.to('/newsletters/n1/confirmation')).toHaveLength(0);
});

test('failed confirmation remains visible, keeps edits, and never sends', async () => {
  const api = serve(path => path === '/newsletters/n1/confirmation' ? jsonResponse({ detail: 'Attivazione produzione sospesa' }, 400) : undefined as unknown as Response);
  mount();
  await testAndApprove();
  await user().click(screen.getByRole('button', { name: 'Prepara conferma invio' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Attivazione produzione sospesa');
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveValue(initial.markdown);
  expect(api.to('/newsletters/n1/send')).toHaveLength(0);
});

test('newsletter list shows multiple drafts, archive filter and load failures rather than a fake empty success', async () => {
  let fail = false;
  serve(path => path === '/newsletters' ? fail ? jsonResponse({}, 503) : jsonResponse([initial, { ...initial, id: 'n2', title: 'Seconda bozza' }, { ...initial, id: 'n3', title: 'Storico', archived: true }]) : undefined as unknown as Response);
  const first = mount(full, '/admin/newsletters');
  await screen.findByRole('link', { name: initial.title });
  expect(screen.getByRole('link', { name: 'Seconda bozza' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Storico' })).not.toBeInTheDocument();
  await user().click(screen.getByRole('checkbox', { name: 'Mostra anche le archiviate' }));
  expect(screen.getByRole('link', { name: 'Storico' })).toBeInTheDocument();
  first.unmount();
  fail = true;
  mount(full, '/admin/newsletters');
  await screen.findByRole('alert');
  expect(screen.queryByText('Nessuna newsletter')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
});

test('new newsletter persists independently without implicit generation or sending', async () => {
  const created = { ...initial, version: 1, title: 'Nuova bozza', subject: 'Nuovo oggetto', markdown: 'Nuovo contenuto' };
  const api = serve((path, init) => path === '/newsletters' && init.method === 'POST' ? jsonResponse(created) : undefined);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount(full, '/admin/newsletters/new');
  fireEvent.change(screen.getByRole('textbox', { name: 'Titolo interno' }), { target: { value: created.title } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Oggetto email' }), { target: { value: created.subject } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Contenuto Markdown' }), { target: { value: created.markdown } });
  expect(api.to('/newsletters')).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Salva bozza' }));
  await screen.findByRole('button', { name: 'Clona in una nuova bozza' });
  expect(JSON.parse(String(api.to('/newsletters')[0].init.body))).toEqual({ kind: 'generic', title: created.title, subject: created.subject, markdown: created.markdown });
  expect(confirm).not.toHaveBeenCalled();
  expect(api.to('/newsletters/n1/generate')).toHaveLength(0);
  expect(api.to('/newsletters/n1/send')).toHaveLength(0);
});

test('cloning a frozen newsletter opens a different draft, without carrying approvals', async () => {
  const cloned = { ...initial, id: 'n2', title: 'Copia newsletter', version: 1 };
  const api = serve((path, init) => {
    if (path === '/newsletters/n1/clone') return jsonResponse(cloned);
    if (path === '/newsletters/n2' && !init.method) return jsonResponse(cloned);
    if (path === '/newsletters/n2/history') return jsonResponse([]);
    return undefined;
  }, config, { ...initial, productionStatus: 'accepted' });
  mount();
  await user().click(await screen.findByRole('button', { name: 'Clona in una nuova bozza' }));
  await screen.findByRole('heading', { name: cloned.title });
  expect(await screen.findByRole('textbox', { name: 'Oggetto email' })).not.toHaveAttribute('readonly');
  expect(api.to('/newsletters/n1/clone')).toHaveLength(1);
  expect(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
});

test('archive is confirmed, versioned, and leaves content and history readable', async () => {
  const api = serve(path => path === '/newsletters/n1/archive' ? jsonResponse({ ...initial, version: 4, archived: true }) : undefined);
  mount();
  await user().click(await screen.findByRole('button', { name: 'Archivia' }));
  const dialog = await screen.findByRole('dialog', { name: 'Archiviare la newsletter?' });
  expect(api.to('/newsletters/n1/archive')).toHaveLength(0);
  await user().click(within(dialog).getByRole('button', { name: 'Archivia' }));
  await screen.findByText('Newsletter archiviata');
  expect(JSON.parse(String(api.to('/newsletters/n1/archive')[0].init.body))).toEqual({ version: 3 });
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveValue(initial.markdown);
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveAttribute('readonly');
});

test('ambiguous production is locked until sender records verified reconciliation and reason', async () => {
  const attempt = { id: 'p1', mode: 'production', recipient: config.distributionAddress, status: 'unknown', occurredAt: '2026-10-21T09:03:00Z', messageId: '<message@example.test>' };
  const api = serve(path => {
    if (path === '/newsletters/n1/history') return jsonResponse([attempt]);
    if (path === '/newsletters/n1/reconcile') return jsonResponse({ ...initial, productionStatus: 'not-submitted', version: 4 });
    return undefined;
  }, config, { ...initial, productionStatus: 'unknown' });
  mount(['newsletters.read', 'newsletters.send']);
  await screen.findByText(/Esito SMTP incerto/);
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
  await user().click(await screen.findByRole('button', { name: 'Riconcilia esito incerto' }));
  const dialog = await screen.findByRole('dialog', { name: 'Riconcilia dopo verifica dei log SMTP' });
  expect(dialog).toHaveTextContent(attempt.messageId);
  await user().click(within(dialog).getByRole('button', { name: 'Registra esito verificato' }));
  expect(api.to('/newsletters/n1/reconcile')).toHaveLength(0);
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motivazione e riscontro nei log (obbligatori)' }), { target: { value: 'Log verificati: nessuna sottomissione' } });
  await user().selectOptions(within(dialog).getByRole('combobox', { name: 'Esito verificato' }), 'not-submitted');
  await user().click(within(dialog).getByRole('button', { name: 'Registra esito verificato' }));
  await waitFor(() => expect(api.to('/newsletters/n1/reconcile')).toHaveLength(1));
  expect(JSON.parse(String(api.to('/newsletters/n1/reconcile')[0].init.body))).toEqual({ attemptId: 'p1', outcome: 'not-submitted', reason: 'Log verificati: nessuna sottomissione' });
  expect(api.to('/newsletters/n1/send')).toHaveLength(0);
});

test('Markdown toolbar wraps the selected content and marks the draft unsaved', async () => {
  serve();
  mount();
  const textarea = await screen.findByRole('textbox', { name: 'Contenuto Markdown' }) as HTMLTextAreaElement;
  textarea.setSelectionRange(0, 5);
  await user().click(screen.getByRole('button', { name: 'Grassetto' }));
  expect(textarea).toHaveValue('**Testo** iniziale');
  expect(screen.getByRole('button', { name: 'Prepara anteprima' })).toBeDisabled();
});

test('lost production response is never auto-retried and locks the local draft pending reconciliation', async () => {
  const api = serve(path => {
    if (path === '/newsletters/n1/send') throw new Error('Connessione interrotta dopo la conferma');
    return undefined;
  });
  mount();
  await testAndApprove();
  await user().click(screen.getByRole('button', { name: 'Prepara conferma invio' }));
  const dialog = await screen.findByRole('dialog', { name: 'Conferma finale di invio in produzione' });
  await user().click(within(dialog).getByRole('button', { name: 'Confermo: invia all’appliance SMTP' }));
  await screen.findByText(/Esito SMTP incerto/);
  expect(screen.getByText('Connessione interrotta dopo la conferma')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveAttribute('readonly');
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
  expect(api.to('/newsletters/n1/send')).toHaveLength(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('malformed preview images fail closed instead of enabling test or visual approval', async () => {
  serve(path => path === '/newsletters/n1/preview' ? jsonResponse({ ...preview, images: [{ cid: 'bad', contentType: 'image/png', base64: '%%%%' }] }) : undefined);
  mount();
  await user().click(await screen.findByRole('button', { name: 'Prepara anteprima' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile visualizzare le immagini');
  expect(screen.getByRole('button', { name: 'Invia prova' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Ho verificato visivamente/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Prepara conferma invio' })).toBeDisabled();
});

test('unknown test attempts can be reconciled with either verified outcome and require a trimmed ten-character reason', async () => {
  const attempt = { id: 'test-unknown', mode: 'test', recipient: config.defaultTestAddress, status: 'unknown', occurredAt: '2026-10-21T09:03:00Z', messageId: '<test@example.test>' };
  const api = serve(path => {
    if (path === '/newsletters/n1/history') return jsonResponse([attempt]);
    if (path === '/newsletters/n1/reconcile') return jsonResponse(initial);
    return undefined;
  });
  mount(['newsletters.read', 'newsletters.send']);
  await user().click(await screen.findByRole('button', { name: 'Riconcilia esito incerto' }));
  const dialog = await screen.findByRole('dialog', { name: 'Riconcilia dopo verifica dei log SMTP' });
  const outcome = within(dialog).getByRole('combobox', { name: 'Esito verificato' });
  expect(within(outcome).getAllByRole('option').map(option => option.getAttribute('value'))).toEqual(['accepted', 'not-submitted']);
  expect(outcome).toBeEnabled();
  const reason = within(dialog).getByRole('textbox', { name: 'Motivazione e riscontro nei log (obbligatori)' });
  fireEvent.change(reason, { target: { value: '   breve   ' } });
  await user().click(within(dialog).getByRole('button', { name: 'Registra esito verificato' }));
  expect(api.to('/newsletters/n1/reconcile')).toHaveLength(0);
  expect(dialog).toBeInTheDocument();
  await user().selectOptions(outcome, 'not-submitted');
  fireEvent.change(reason, { target: { value: '  Log prova: nessuna sottomissione  ' } });
  await user().click(within(dialog).getByRole('button', { name: 'Registra esito verificato' }));
  await waitFor(() => expect(api.to('/newsletters/n1/reconcile')).toHaveLength(1));
  expect(JSON.parse(String(api.to('/newsletters/n1/reconcile')[0].init.body))).toEqual({ attemptId: attempt.id, outcome: 'not-submitted', reason: 'Log prova: nessuna sottomissione' });
  expect(api.to('/newsletters/n1/test')).toHaveLength(0);
  expect(api.to('/newsletters/n1/send')).toHaveLength(0);
});

test.each(['accepted', 'not-submitted'] as const)('terminal persisted %s attempt completes only its server-required outcome', async persistedOutcome => {
  const attempt = { id: 'production-terminal', mode: 'production', recipient: config.distributionAddress, status: persistedOutcome, occurredAt: '2026-10-21T09:03:00Z', reconciliationRequired: true, reconciliationOutcome: persistedOutcome };
  const api = serve(path => {
    if (path === '/newsletters/n1/history') return jsonResponse([attempt]);
    if (path === '/newsletters/n1/reconcile') return jsonResponse({ ...initial, productionStatus: persistedOutcome });
    return undefined;
  }, config, { ...initial, productionStatus: 'unknown' });
  mount(['newsletters.read', 'newsletters.send']);
  await user().click(await screen.findByRole('button', { name: 'Completa riconciliazione invio' }));
  const dialog = await screen.findByRole('dialog', { name: 'Riconcilia dopo verifica dei log SMTP' });
  expect(dialog).toHaveTextContent('L’esito è già registrato');
  const outcome = within(dialog).getByRole('combobox', { name: 'Esito verificato' });
  expect(outcome).toBeDisabled();
  expect(outcome).toHaveValue(persistedOutcome);
  expect(within(outcome).getAllByRole('option')).toHaveLength(1);
  expect(within(outcome).getByRole('option')).toHaveValue(persistedOutcome);
  fireEvent.change(outcome, { target: { value: persistedOutcome === 'accepted' ? 'not-submitted' : 'accepted' } });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Motivazione e riscontro nei log (obbligatori)' }), { target: { value: 'Riscontro persistito verificato nei log SMTP' } });
  await user().click(within(dialog).getByRole('button', { name: 'Registra esito verificato' }));
  await waitFor(() => expect(api.to('/newsletters/n1/reconcile')).toHaveLength(1));
  expect(JSON.parse(String(api.to('/newsletters/n1/reconcile')[0].init.body))).toEqual({ attemptId: attempt.id, outcome: persistedOutcome, reason: 'Riscontro persistito verificato nei log SMTP' });
  expect(api.to('/newsletters/n1/send')).toHaveLength(0);
});

test('explicit reconciliationRequired false overrides unknown fallback and read-only accounts never reconcile', async () => {
  const attempts = [
    { id: 'a1', mode: 'test', recipient: config.defaultTestAddress, status: 'unknown', occurredAt: '2026-10-21T09:03:00Z', reconciliationRequired: false },
    { id: 'a2', mode: 'production', recipient: config.distributionAddress, status: 'accepted', occurredAt: '2026-10-21T09:03:00Z', reconciliationRequired: true, reconciliationOutcome: 'accepted' },
  ];
  serve(path => path === '/newsletters/n1/history' ? jsonResponse(attempts) : undefined);
  const view = mount(['newsletters.read', 'newsletters.send']);
  await screen.findByRole('button', { name: 'Completa riconciliazione invio' });
  expect(screen.queryByRole('button', { name: 'Riconcilia esito incerto' })).not.toBeInTheDocument();
  view.unmount();
  mount(['newsletters.read']);
  await screen.findByText('Produzione · Accettato da SMTP');
  expect(screen.queryByRole('button', { name: 'Completa riconciliazione invio' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Riconcilia esito incerto' })).not.toBeInTheDocument();
});
