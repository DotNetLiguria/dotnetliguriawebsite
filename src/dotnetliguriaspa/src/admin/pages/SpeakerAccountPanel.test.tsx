import React from 'react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, mockApi, render, screen, waitFor } from '../../test-utils';
import { CapabilityContext } from '../../account/AccountCapabilities';
import { useMfaWindow } from '../../account/useMfaWindow';
import SpeakerAccountPanel from './SpeakerAccountPanel';

vi.mock('../../account/useMfaWindow', () => ({ useMfaWindow: vi.fn() }));
const account = { subject: 'subject-1', username: 'speaker', enabled: true };
const user = () => userEvent.setup({ delay: null });
const base = { speakerId: 's1', email: 'speaker@example.test', account: null, candidates: [], onboardingState: null };
beforeEach(() => vi.mocked(useMfaWindow).mockReturnValue({ active: true, strong: true, remaining: 250, level: 'mfa' }));

test('email matches never auto-link or send invitations and existing-account linking requires explicit confirmation', async () => {
  const writes: { path: string; body: unknown; headers: HeadersInit | undefined }[] = [];
  let linked = false;
  mockApi({ '/admin/speaker-accounts/s1': (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      writes.push({ path, body: JSON.parse(String(init.body)), headers: init.headers });
      linked = true;
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ ...base, account: linked ? account : null, candidates: linked ? [] : [account] });
  } });
  render(<SpeakerAccountPanel speakerId="s1" />);
  await screen.findByRole('button', { name: 'Collega speaker' });
  expect(writes).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Crea account e invia invito' })).not.toBeInTheDocument();
  await user().click(screen.getByRole('button', { name: 'Collega speaker' }));
  expect(writes).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Conferma modifica account speaker' }));
  await screen.findByText('Account collegato: speaker');
  expect(writes).toEqual([{
    path: expect.stringMatching(/\/link$/),
    body: { expectedEmail: 'speaker@example.test', subject: 'subject-1' },
    headers: expect.objectContaining({ 'X-Confirm-Speaker-Change': 'link' }),
  }]);
  expect(screen.queryByRole('button', { name: /Invia nuovamente/ })).not.toBeInTheDocument();
});

test('creation and invitation are separately confirmed and provider acceptance is not reported as delivery', async () => {
  const writes: { body: unknown; headers: HeadersInit | undefined }[] = [];
  let created = false;
  mockApi({ '/admin/speaker-accounts/s1': (_path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      writes.push({ body: JSON.parse(String(init.body)), headers: init.headers });
      created = true;
    }
    return jsonResponse({ ...base, account: created ? account : null, onboardingState: created ? 'invited' : null });
  } });
  render(<SpeakerAccountPanel speakerId="s1" />);
  await user().click(await screen.findByRole('button', { name: 'Crea account e invia invito' }));
  expect(writes).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Conferma modifica account speaker' }));
  expect(await screen.findByText(/La consegna dell’email non è verificata/)).toBeInTheDocument();
  expect(writes[0]).toEqual({
    body: { expectedEmail: 'speaker@example.test' },
    headers: expect.objectContaining({ 'X-Confirm-Speaker-Change': 'create-and-invite' }),
  });
});

test('a failed invitation leaves the linked account visible and resend is explicit', async () => {
  const writes: { path: string; body: unknown }[] = [];
  mockApi({ '/admin/speaker-accounts/s1': (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') writes.push({ path, body: JSON.parse(String(init.body)) });
    return jsonResponse({ ...base, account, onboardingState: 'invitation-failed' });
  } });
  render(<SpeakerAccountPanel speakerId="s1" />);
  expect(await screen.findByText(/invio dell’invito non riuscito/)).toBeInTheDocument();
  expect(screen.getByText('Account collegato: speaker')).toBeInTheDocument();
  await user().click(screen.getByRole('button', { name: 'Invia nuovamente l’invito' }));
  expect(writes).toHaveLength(0);
  await user().click(screen.getByRole('button', { name: 'Conferma modifica account speaker' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ path: expect.stringMatching(/\/resend-invitation$/), body: { subject: account.subject, expectedEmail: base.email } });
});

test.each(['create-pending', 'create-uncertain', 'created-unverified'])('never offers a blind retry for %s', async onboardingState => {
  mockApi({ '/admin/speaker-accounts/s1': { ...base, onboardingState } });
  render(<SpeakerAccountPanel speakerId="s1" />);
  await screen.findByRole('status');
  await waitFor(() => expect(screen.queryByText('Verifica account speaker…')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Crea account e invia invito' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Invia nuovamente l’invito' })).not.toBeInTheDocument();
});

test('recent MFA and the nondelegable create permission are required, while link-only editors can associate existing users', async () => {
  mockApi({ '/admin/speaker-accounts/s1': { ...base, candidates: [account] } });
  render(<CapabilityContext.Provider value={{ status: 'ready',
    capabilities: { schemaVersion: 1, permissions: ['speakers.read', 'speakers.manage', 'access.users.read'], canAccessAdmin: true },
    clear: vi.fn(), retry: vi.fn(), refresh: vi.fn() }}><SpeakerAccountPanel speakerId="s1" /></CapabilityContext.Provider>);
  expect(await screen.findByRole('button', { name: 'Collega speaker' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Crea account e invia invito' })).not.toBeInTheDocument();
});

test('expired MFA disables both association and account creation', async () => {
  vi.mocked(useMfaWindow).mockReturnValue({ active: false, strong: true, remaining: 0, level: 'mfa' });
  mockApi({ '/admin/speaker-accounts/s1': { ...base, candidates: [account] } });
  render(<SpeakerAccountPanel speakerId="s1" />);
  expect(await screen.findByRole('button', { name: 'Collega speaker' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Verifica MFA' })).toBeEnabled();
});

test('content-only editors do not request private account data', () => {
  render(<CapabilityContext.Provider value={{ status: 'ready',
    capabilities: { schemaVersion: 1, permissions: ['speakers.read', 'speakers.manage'], canAccessAdmin: true },
    clear: vi.fn(), retry: vi.fn(), refresh: vi.fn() }}><SpeakerAccountPanel speakerId="s1" /></CapabilityContext.Provider>);
  expect(fetch).not.toHaveBeenCalled();
});
