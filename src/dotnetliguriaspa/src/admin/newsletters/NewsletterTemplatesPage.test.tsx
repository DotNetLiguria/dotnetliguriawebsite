import React from 'react';
import { Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, jsonResponse, render, screen, waitFor, within } from '../../test-utils';
import { CapabilityContext } from '../../account/AccountCapabilities';
import type { Permission } from '../../account/permissions';
import NewsletterTemplatesPage from './NewsletterTemplatesPage';
import type { NewsletterTemplate } from './types';

const template: NewsletterTemplate = { id: 't1', kind: 'event', name: 'Annuncio evento', subject: '{{event.title}}', markdown: '## {{event.title}}\n{{event.talksMarkdown}}', version: 7, archived: false };
type Handler = (path: string, init: RequestInit) => Response | Promise<Response> | undefined;
function serve(handler?: Handler) {
  const calls: { path: string; init: RequestInit }[] = [];
  vi.mocked(fetch).mockImplementation(async (input, init = {}) => {
    const path = new URL(String(input), 'https://localhost').pathname.replace(/^\/api/, '');
    calls.push({ path, init });
    const custom = await handler?.(path, init);
    if (custom) return custom;
    if (path === '/newsletter-templates/t1' && !init.method) return jsonResponse(template);
    if (path === '/newsletter-templates') return jsonResponse([template, { ...template, id: 't2', name: 'Vecchio modello', archived: true }]);
    if (path === '/newsletters/events') return jsonResponse([{ id: 'e1', title: 'Evento futuro', date: '2026-11-01', startTime: '09:00', endTime: '18:00', locationName: 'Genova' }]);
    if (path === '/newsletter-templates/t1/preview') return jsonResponse({ subject: 'Evento futuro', markdown: '## Evento futuro', html: '<h1>Evento futuro</h1>', plainText: 'Evento futuro', images: [], warnings: ['Controlla la sede'] });
    throw new Error(`Unexpected request ${init.method ?? 'GET'} ${path}`);
  });
  return { calls, to: (path: string, method = 'POST') => calls.filter(call => call.path === path && (call.init.method ?? 'GET') === method) };
}

function mount(permissions: Permission[] = ['newsletters.read', 'newsletters.manage'], route = '/admin/newsletter-templates/t1') {
  return render(<CapabilityContext.Provider value={{ status: 'ready', capabilities: { schemaVersion: 1, permissions, canAccessAdmin: true }, retry: vi.fn(), refresh: vi.fn(), clear: vi.fn() }}>
    <Routes>
      <Route path="/admin/newsletter-templates" element={<NewsletterTemplatesPage />} />
      <Route path="/admin/newsletter-templates/:id" element={<NewsletterTemplatesPage />} />
    </Routes>
  </CapabilityContext.Provider>, { route });
}
const user = () => userEvent.setup({ delay: null, pointerEventsCheck: 0 });
beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:template'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => vi.restoreAllMocks());

test('separate template section lists active revisions, hides archive and offers creation only to editors', async () => {
  serve();
  mount(['newsletters.read'], '/admin/newsletter-templates');
  expect(await screen.findByRole('link', { name: template.name })).toHaveAttribute('href', '/admin/newsletter-templates/t1');
  expect(screen.queryByRole('link', { name: 'Vecchio modello' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Nuovo template' })).not.toBeInTheDocument();
  await user().click(screen.getByRole('checkbox', { name: 'Mostra anche i template archiviati' }));
  expect(screen.getByRole('link', { name: 'Vecchio modello' })).toBeInTheDocument();
});

test('event template preview uses eligible event combobox and authoritative server result', async () => {
  const api = serve();
  mount();
  await screen.findByRole('textbox', { name: 'Nome template' });
  expect(screen.getByText('{{event.talksMarkdown}}', { selector: 'code' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Prepara anteprima template' })).toBeDisabled();
  await screen.findByRole('option', { name: /Evento futuro/ });
  await user().selectOptions(screen.getByRole('combobox', { name: 'Evento pubblicato in corso o futuro' }), 'e1');
  expect(api.to('/newsletter-templates/t1/preview')).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Prepara anteprima template' }));
  const frame = await screen.findByTitle('Anteprima email isolata');
  expect(frame.getAttribute('srcdoc')).toContain('Evento futuro');
  expect(screen.getByText('Controlla la sede')).toBeInTheDocument();
  expect(JSON.parse(String(api.to('/newsletter-templates/t1/preview')[0].init.body))).toEqual({ version: 7, eventId: 'e1' });
  fireEvent.change(screen.getByRole('textbox', { name: 'Oggetto del template' }), { target: { value: 'Oggetto nuovo' } });
  expect(screen.queryByTitle('Anteprima email isolata')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Prepara anteprima template' })).toBeDisabled();
});

test('template conflicts preserve local edits and send exact version without touching newsletter routes', async () => {
  const api = serve((path, init) => path === '/newsletter-templates/t1' && init.method === 'PUT' ? jsonResponse({}, 409) : undefined);
  mount();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Nome template' }), { target: { value: 'Nome modificato' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Contenuto Markdown' }), { target: { value: 'Markdown personale' } });
  await user().click(screen.getByRole('button', { name: 'Salva template' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Conflitto di versione');
  expect(screen.getByRole('textbox', { name: 'Nome template' })).toHaveValue('Nome modificato');
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveValue('Markdown personale');
  expect(JSON.parse(String(api.to('/newsletter-templates/t1', 'PUT')[0].init.body))).toEqual({ version: 7, name: 'Nome modificato', subject: template.subject, markdown: 'Markdown personale' });
  expect(api.calls.some(call => call.path === '/newsletters')).toBe(false);
});

test('read-only templates allow saved preview but no editing/archive; manage without read loads nothing', async () => {
  const api = serve();
  const view = mount(['newsletters.read']);
  const name = await screen.findByRole('textbox', { name: 'Nome template' });
  expect(name).toHaveAttribute('readonly');
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveAttribute('readonly');
  expect(screen.queryByRole('button', { name: 'Salva template' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Archivia template' })).not.toBeInTheDocument();
  expect(api.calls.every(call => !call.init.method)).toBe(true);
  view.unmount();
  const count = api.calls.length;
  mount(['newsletters.manage']);
  expect(screen.getByRole('alert')).toHaveTextContent('Non disponi del permesso');
  expect(api.calls).toHaveLength(count);
});

test('new generic template is manually created, persisted and routed to its own editor', async () => {
  const created = { ...template, kind: 'generic', name: 'Nuovo modello', subject: 'Oggetto', markdown: '**Contenuto**', version: 1 };
  const api = serve((path, init) => {
    if (path === '/newsletter-templates' && init.method === 'POST') return jsonResponse(created);
    if (path === '/newsletter-templates/t1' && !init.method) return jsonResponse(created);
    return undefined;
  });
  mount(undefined, '/admin/newsletter-templates/new');
  fireEvent.change(screen.getByRole('textbox', { name: 'Nome template' }), { target: { value: created.name } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Oggetto del template' }), { target: { value: created.subject } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Contenuto Markdown' }), { target: { value: created.markdown } });
  expect(api.to('/newsletter-templates')).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Salva template' }));
  await screen.findByRole('heading', { name: created.name });
  expect(JSON.parse(String(api.to('/newsletter-templates')[0].init.body))).toEqual({ kind: 'generic', name: created.name, subject: created.subject, markdown: created.markdown });
  expect(await screen.findByRole('button', { name: 'Prepara anteprima template' })).toBeEnabled();
});

test('archive template needs confirmation and persists version without deleting content', async () => {
  const api = serve(path => path === '/newsletter-templates/t1/archive' ? jsonResponse({ ...template, archived: true, version: 8 }) : undefined);
  mount();
  await user().click(await screen.findByRole('button', { name: 'Archivia template' }));
  const dialog = await screen.findByRole('dialog', { name: 'Archiviare il template?' });
  expect(api.to('/newsletter-templates/t1/archive')).toHaveLength(0);
  await user().click(within(dialog).getByRole('button', { name: 'Archivia template' }));
  expect(await screen.findByText('Template archiviato')).toBeInTheDocument();
  expect(JSON.parse(String(api.to('/newsletter-templates/t1/archive')[0].init.body))).toEqual({ version: 7 });
  expect(screen.getByRole('textbox', { name: 'Contenuto Markdown' })).toHaveValue(template.markdown);
  expect(screen.queryByRole('button', { name: 'Salva template' })).not.toBeInTheDocument();
});

test('abandoning conflicting template edits requires an explicit discard dialog', async () => {
  serve();
  mount();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Nome template' }), { target: { value: 'Da conservare' } });
  await user().click(screen.getByRole('button', { name: 'Ricarica versione salvata' }));
  const dialog = await screen.findByRole('dialog', { name: 'Abbandonare le modifiche al template?' });
  await user().click(within(dialog).getByRole('button', { name: 'Annulla' }));
  expect(screen.getByRole('textbox', { name: 'Nome template' })).toHaveValue('Da conservare');
  await user().click(screen.getByRole('button', { name: 'Ricarica versione salvata' }));
  await user().click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbandona e ricarica' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nome template' })).toHaveValue(template.name));
});

test('old event template preview cannot reappear after reloading the template', async () => {
  let resolve!: (response: Response) => void;
  serve(path => path === '/newsletter-templates/t1/preview' ? new Promise<Response>(done => { resolve = done; }) : undefined);
  mount();
  await screen.findByRole('textbox', { name: 'Nome template' });
  await screen.findByRole('option', { name: /Evento futuro/ });
  await user().selectOptions(screen.getByRole('combobox', { name: 'Evento pubblicato in corso o futuro' }), 'e1');
  await user().click(screen.getByRole('button', { name: 'Prepara anteprima template' }));
  // Busy template controls prevent any persisted content changes until this response is settled.
  expect(screen.getByRole('button', { name: 'Ricarica versione salvata' })).toBeDisabled();
  await act(async () => resolve(jsonResponse({ subject: 'Oggetto', markdown: 'Markdown', html: '<p>Corpo</p>', plainText: 'Corpo', images: [], warnings: [] })));
  await screen.findByTitle('Anteprima email isolata');
  await user().click(screen.getByRole('button', { name: 'Ricarica versione salvata' }));
  await waitFor(() => expect(screen.queryByTitle('Anteprima email isolata')).not.toBeInTheDocument());
});
